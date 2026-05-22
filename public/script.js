"use strict";

import { marked } from "./marked.js";

const API_URL = "https://rwkv.theglasshaus.org/prompt/complete";

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
const temperatureEl = getEl("temperature");
const temperatureValueEl = getEl("temperatureValue");
const copyBtnEl = getEl("copyBtn");

if (maxTokensEl && maxTokensValueEl) {
  maxTokensEl.addEventListener("input", () => {
    maxTokensValueEl.textContent = maxTokensEl.value;
  });
}

if (temperatureEl && temperatureValueEl) {
  temperatureEl.addEventListener("input", () => {
    temperatureValueEl.textContent = temperatureEl.value;
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

function countWords(text) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function updateMeta(text) {
  if (!responseMetaEl) return;
  const chars = text.length;
  const words = countWords(text);
  responseMetaEl.textContent = `${chars} chars · ${words} words`;
}

function renderOutput(text) {
  if (!responseEl) return;
  if (!text) {
    responseEl.innerHTML = "";
    return;
  }
  responseEl.innerHTML = marked.parse(text, { breaks: true });
  responseEl.scrollTop = responseEl.scrollHeight;
}

async function sendPrompt() {
  if (!promptEl || !statusEl || !sendEl || !responseEl || !responseMetaEl || !maxTokensEl || !temperatureEl) {
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
  responseEl.innerHTML = "";
  responseMetaEl.textContent = "";

  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt,
        max_tokens: Number(maxTokensEl.value),
        temperature: Number(temperatureEl.value),
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
            renderOutput(output);
            updateMeta(output);
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
          renderOutput(output);
          updateMeta(output);
        }
      } catch {
        // ignore malformed JSON
      }
    }

    statusEl.textContent = "Done";
    statusEl.className = "status";
  } catch (err) {
    responseEl.innerHTML = "";
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
