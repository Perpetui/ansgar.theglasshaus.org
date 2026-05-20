"use strict";

const API_URL = "/api/agent";

function getEl(id) {
  const el = document.getElementById(id);
  if (!el) {
    console.error(`Missing element: #${id}`);
  }
  return el;
}

const promptEl = getEl("prompt");
const sendEl = getEl("send");
const responseEl = getEl("response");
const statusEl = getEl("status");
const responseMetaEl = getEl("responseMeta");
const maxTokensEl = getEl("maxTokens");
const maxTokensValueEl = getEl("maxTokensValue");
const copyBtnEl = getEl("copyBtn");

if (maxTokensEl && maxTokensValueEl) {
  maxTokensEl.addEventListener("input", () => {
    maxTokensValueEl.textContent = maxTokensEl.value;
  });
}

async function copyToClipboard(text) {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return;
  }

  // Fallback for non-secure contexts or older browsers
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  textarea.style.top = "0";
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();

  try {
    const successful = document.execCommand("copy");
    if (!successful) {
      throw new Error("execCommand returned false");
    }
  } finally {
    document.body.removeChild(textarea);
  }
}

if (copyBtnEl && responseEl) {
  copyBtnEl.addEventListener("click", async () => {
    const text = responseEl.textContent || "";
    if (!text.trim()) return;
    try {
      await copyToClipboard(text);
      copyBtnEl.classList.add("copied");
      setTimeout(() => {
        copyBtnEl.classList.remove("copied");
      }, 2000);
    } catch (err) {
      console.error("Clipboard copy failed:", err);
    }
  });
}

async function sendPrompt() {
  if (!promptEl || !statusEl || !sendEl || !responseEl || !responseMetaEl || !maxTokensEl) {
    console.error("Required DOM elements are missing; aborting sendPrompt.");
    return;
  }

  const prompt = promptEl.value.trim();
  if (!prompt) {
    statusEl.textContent = "Please enter a prompt.";
    statusEl.className = "status error";
    return;
  }

  sendEl.disabled = true;
  statusEl.textContent = "Sending...";
  statusEl.className = "status sending";
  responseEl.textContent = "";
  responseMetaEl.textContent = "";

  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt,
        max_tokens: Number(maxTokensEl.value),
      }),
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }

    if (!res.body) {
      throw new Error("Response body is empty.");
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let output = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop(); // keep incomplete line

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          const parsed = JSON.parse(trimmed);
          if (parsed && typeof parsed.chunk === "string") {
            output += parsed.chunk;
            responseEl.textContent = output;
            responseMetaEl.textContent = `${output.length} chars`;
          }
        } catch {
          // ignore malformed JSON lines
        }
      }
    }

    // process any remaining data in buffer
    const trimmed = buffer.trim();
    if (trimmed) {
      try {
        const parsed = JSON.parse(trimmed);
        if (parsed && typeof parsed.chunk === "string") {
          output += parsed.chunk;
          responseEl.textContent = output;
          responseMetaEl.textContent = `${output.length} chars`;
        }
      } catch {
        // ignore malformed JSON
      }
    }

    statusEl.textContent = "Done";
    statusEl.className = "status";
  } catch (err) {
    responseEl.textContent = "";
    statusEl.textContent = `Error: ${err.message}`;
    statusEl.className = "status error";
  } finally {
    sendEl.disabled = false;
  }
}

if (sendEl && promptEl) {
  sendEl.addEventListener("click", sendPrompt);
  promptEl.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      sendPrompt();
    }
  });
}
