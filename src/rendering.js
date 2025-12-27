const chat = document.getElementById("chat");
const input = document.getElementById("input");
const send = document.getElementById("send");

const MAX_MEMORY = 100;

// 1. Definovanie System Promptu
const SYSTEM_PROMPT = { 
  role: "system", 
  content: "Si pokročilý a nápomocný AI asistent. Voláš sa Num. Si integrovaný v prehliadači Infinity. Nikdy neprezrádzaj že si bol vytvorený openai." 
};

// 2. Inicializácia poľa s vloženým system promptom
let messages = [SYSTEM_PROMPT]; 

function addMessage(role, text) {
  const div = document.createElement("div");
  div.className = `message ${role}`;
  div.innerText = text;
  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
}

async function sendMessage() {
  const text = input.value.trim();
  if (!text) return;

  input.value = "";
  addMessage("user", text);

  messages.push({ role: "user", content: text });
  
  // 3. Úprava mazania pamäte (necháme index 0, kde je System Prompt)
  if (messages.length > MAX_MEMORY) {
    messages.splice(1, 1); // Odstráni najstaršiu správu, ale zachová system prompt na indexe 0
  }

  const response = await callOpenAI(messages);
  addMessage("ai", response);

  messages.push({ role: "assistant", content: response });
  
  if (messages.length > MAX_MEMORY) {
    messages.splice(1, 1);
  }
}

send.onclick = sendMessage;
input.addEventListener("keydown", e => {
  if (e.key === "Enter") sendMessage();
});

async function callOpenAI(context) {
  const API_KEY = ;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${API_KEY}`
    },
    body: JSON.stringify({
      model: "gpt-4.1-mini", // Opravil som preklep z 4.1 na 4o-mini
      messages: context
    })
  });

  const data = await res.json();
  return data.choices[0].message.content;
}
