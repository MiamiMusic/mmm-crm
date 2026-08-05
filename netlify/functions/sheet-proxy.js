exports.handler = async function() {
  const url = 'https://docs.google.com/spreadsheets/d/1bGFmDLImeV1GeL8zCUxFp6KhqK4Fh0LxeconnGNBAPE/gviz/tq?tqx=out:csv&sheet=2026%20-%20Active%20Invoices';
  try {
    const res = await fetch(url, { redirect: 'follow' });
    const text = await res.text();
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'text/csv', 'Access-Control-Allow-Origin': '*' },
      body: text,
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
