const { runDailyCheck } = require('../../lib/jobs');

exports.handler = async () => {
  try {
    const result = await runDailyCheck();
    return {
      statusCode: 200,
      body: `Processed ${result.itemsProcessed} items, ${result.urgentSent} urgent alerts sent.`,
    };
  } catch (err) {
    console.error('daily-check failed:', err);
    return { statusCode: 500, body: err.message };
  }
};
