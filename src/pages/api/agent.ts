export const prerender = false;

const BACKEND_URL = "https://rwkv.theglasshaus.org/prompt/complete";

export async function POST({ request }) {
  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { prompt, max_tokens, temperature } = body || {};

  if (typeof prompt !== "string" || !prompt.trim()) {
    return new Response(JSON.stringify({ error: "Missing or empty prompt" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  let backendRes;
  try {
    backendRes = await fetch(BACKEND_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: prompt.trim(),
        max_tokens: typeof max_tokens === "number" ? max_tokens : 1000,
        temperature: typeof temperature === "number" ? temperature : 1.0,
      }),
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: `Proxy connection error: ${err.message}` }),
      {
        status: 502,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  // Interpose a TransformStream so backend HTTP/2 errors don't propagate to the client
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();

  (async () => {
    try {
      if (!backendRes.body) {
        writer.close();
        return;
      }
      const reader = backendRes.body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        await writer.write(value);
      }
      writer.close();
    } catch {
      // Backend closed stream uncleanly (HTTP/2 INTERNAL_ERROR).
      // Just close the writer cleanly so the client gets all data received so far.
      try {
        writer.close();
      } catch {
        // already closed
      }
    }
  })();

  return new Response(readable, {
    status: backendRes.status,
    headers: { "Content-Type": "application/json" },
  });
}
