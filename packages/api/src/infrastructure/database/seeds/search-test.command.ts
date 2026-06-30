import { Command, CommandRunner } from 'nest-commander';
import { Inject } from '@nestjs/common';
import { IDrinkSearcherPort } from '@application/ports/outbound';

/**
 * Test queries to verify semantic search functionality.
 * These queries test different aspects of natural language understanding.
 */
const TEST_QUERIES = [
  // Temperature preferences
  'something cold and refreshing',
  'a hot drink to warm me up',
  'iced coffee',

  // Flavor preferences
  'something sweet with caramel',
  'chocolate flavored drink',
  'vanilla drink',

  // Dietary/ingredient preferences
  'something without coffee',
  'tea based drink',
  'fruity and refreshing',

  // Mood/occasion based
  'I need energy boost',
  'something for a hot summer day',
  'cozy autumn drink',

  // Specific descriptors
  'creamy latte',
  'strong espresso',
  'blended frozen drink',
];

@Command({
  name: 'search-test',
  description: 'Test semantic search with various queries',
})
export class SearchTestCommand extends CommandRunner {
  // private readonly logger = new Logger(SearchTestCommand.name);

  constructor(
    @Inject('IDrinkSearcher')
    private readonly drinkSearcher: IDrinkSearcherPort,
  ) {
    super();
  }

  async run(): Promise<void> {
    console.log('\n🔍 Testing Semantic Search\n');
    console.log('='.repeat(60));

    for (const query of TEST_QUERIES) {
      await this.testQuery(query);
    }

    console.log('\n✅ Search test completed!\n');
  }

  private async testQuery(query: string): Promise<void> {
    console.log(`\n📝 Query: "${query}"`);
    console.log('-'.repeat(60));

    try {
      const results = await this.drinkSearcher.findSimilar(query, 3);

      if (results.length === 0) {
        console.log('   No results found');
        return;
      }

      for (const result of results) {
        const scorePercent = (result.score * 100).toFixed(1);
        const price = (result.drink.basePrice.cents / 100).toFixed(2);
        console.log(`   ${scorePercent}% - ${result.drink.name} ($${price})`);
      }
    } catch (error) {
      console.log(`   ❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}
