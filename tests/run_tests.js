// Master Test Runner for CloudPulse-API
const runStatsTests = require('./stats.test');
const runStoreTests = require('./store.test');
const runApiTests = require('./api.test');

async function main() {
  console.log('====================================================');
  console.log('  CLOUDPULSE-API AUTOMATED QA & INTEGRATION SUITE');
  console.log('====================================================');

  try {
    runStatsTests();
    runStoreTests();
    await runApiTests();

    console.log('====================================================');
    console.log('  🎉 ALL AUTOMATED TESTS PASSED SUCCESSFULLY (100%)');
    console.log('====================================================');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ TEST FAILURE:', err.message);
    console.error(err.stack);
    process.exit(1);
  }
}

main();
