const { runWeeklyDigest } = require('../../lib/jobs');

exports.handler = async () => {
  try {
    const result = await runWeeklyDigest();
    return {
      statusCode: 200,
      body: result.posted
        ? `Posted weekly digest with ${result.count} items.`
        : 'No items — sent quiet-week note.',
    };
  } catch (err) {
    console.error('weekly-digest failed:', err);
    return { statusCode: 500, body: err.message };
  }
};
