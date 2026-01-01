import { Command, CommandRunner, Option } from 'nest-commander';
import { ChromaClient } from 'chromadb';
import { EnvConfigService } from '@infrastructure/config';

interface ChromaCommandOptions {
  collection?: string;
  limit?: number;
}

@Command({
  name: 'chroma',
  description: 'View ChromaDB collections and data',
})
export class ChromaCommand extends CommandRunner {
  private client!: ChromaClient;

  constructor(private readonly envConfig: EnvConfigService) {
    super();
  }

  async run(_passedParams: string[], options: ChromaCommandOptions): Promise<void> {
    const chromaHost = this.envConfig.chromaHost;

    // Parse URL to extract host, port, and ssl settings
    const url = new URL(chromaHost);
    this.client = new ChromaClient({
      host: url.hostname,
      port: parseInt(url.port || (url.protocol === 'https:' ? '443' : '8000'), 10),
      ssl: url.protocol === 'https:',
    });

    if (options.collection) {
      await this.showCollection(options.collection, options.limit ?? 10);
    } else {
      await this.listCollections();
    }
  }

  private async listCollections(): Promise<void> {
    /* eslint-disable no-console */
    console.log('\n🗂️  ChromaDB Collections\n');

    const collections = await this.client.listCollections();

    if (collections.length === 0) {
      console.log('   No collections found.\n');
      return;
    }

    console.log('   ┌─────────────────────────────────────────────────┐');
    console.log('   │  Name              │  Items                     │');
    console.log('   ├─────────────────────────────────────────────────┤');

    for (const col of collections) {
      const collectionName = typeof col === 'string' ? col : col.name;
      const collection = await this.client.getCollection({ name: collectionName });
      const count = await collection.count();
      const name = collectionName.padEnd(18);
      const countStr = String(count).padEnd(26);
      console.log(`   │  ${name}│  ${countStr}│`);
    }

    console.log('   └─────────────────────────────────────────────────┘');
    console.log('\n   Use --collection <name> to view items\n');
    /* eslint-enable no-console */
  }

  private async showCollection(name: string, limit: number): Promise<void> {
    /* eslint-disable no-console */
    try {
      const collection = await this.client.getCollection({ name });
      const count = await collection.count();
      const results = await collection.get({ limit });

      console.log(`\n📦 Collection: ${name}`);
      console.log(`   Total items: ${count}\n`);

      if (results.ids.length === 0) {
        console.log('   No items in this collection.\n');
        return;
      }

      console.log(`   Showing ${results.ids.length} of ${count} items:\n`);
      console.log('   ─────────────────────────────────────────────────────────');

      for (let i = 0; i < results.ids.length; i++) {
        const id = results.ids[i];
        const metadata = results.metadatas[i];
        const document = results.documents?.[i];

        console.log(`\n   📄 ID: ${id}`);

        if (metadata) {
          const displayName = String(metadata.displayName || metadata.name || 'N/A');
          const price = metadata.basePriceCents
            ? `$${(Number(metadata.basePriceCents) / 100).toFixed(2)}`
            : 'N/A';

          console.log(`      Name: ${displayName}`);
          console.log(`      Price: ${price}`);

          if (metadata.description) {
            const desc = String(metadata.description);
            const truncated = desc.length > 60 ? desc.substring(0, 60) + '...' : desc;
            console.log(`      Description: ${truncated}`);
          }
        }

        if (document) {
          const truncated = document.length > 80 ? document.substring(0, 80) + '...' : document;
          console.log(`      Document: ${truncated}`);
        }
      }

      console.log('\n   ─────────────────────────────────────────────────────────\n');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`\n   ❌ Error: ${message}\n`);
    }
    /* eslint-enable no-console */
  }

  @Option({
    flags: '-c, --collection <name>',
    description: 'Show items from a specific collection',
  })
  parseCollection(val: string): string {
    return val;
  }

  @Option({
    flags: '-l, --limit <number>',
    description: 'Limit number of items to show (default: 10)',
  })
  parseLimit(val: string): number {
    return parseInt(val, 10);
  }
}
