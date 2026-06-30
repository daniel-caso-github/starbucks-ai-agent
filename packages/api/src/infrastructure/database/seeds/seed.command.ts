import { Command, CommandRunner, Option } from 'nest-commander';
import { DrinkSeederService } from './drink-seeder.service';

interface SeedCommandOptions {
  clear?: boolean;
  stats?: boolean;
}

@Command({
  name: 'seed',
  description: 'Seed the database with initial drink data',
})
export class SeedCommand extends CommandRunner {
  constructor(private readonly seederService: DrinkSeederService) {
    super();
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async run(_passedParams: string[], options: SeedCommandOptions): Promise<void> {
    if (options.stats) {
      const stats = await this.seederService.getStats();
      /* eslint-disable no-console */
      console.log('\n📊 Current Database Stats:');
      console.log(`   Total drinks: ${stats.totalDrinks}`);
      console.log('   By category:');
      for (const [category, count] of Object.entries(stats.categories)) {
        console.log(`     - ${category}: ${count}`);
      }
      /* eslint-enable no-console */
      return;
    }

    if (options.clear) {
      await this.seederService.reseed();
    } else {
      await this.seederService.seed();
    }

    // eslint-disable-next-line no-console
    console.log('\n✅ Seed completed successfully!');
  }

  @Option({
    flags: '-c, --clear',
    description: 'Clear existing data before seeding',
  })
  parseClear(): boolean {
    return true;
  }

  @Option({
    flags: '-s, --stats',
    description: 'Show current database statistics',
  })
  parseStats(): boolean {
    return true;
  }
}
