const apiKey = '4f5f42aff8f9d98f21ef54a0a380798a';
const apiToken = '036f7c5b3fd10dc524612fac08e5495a93e06bf3201b97de2fa7aed32c543b1e';
const cardId = '680e17daec2c551018e54217'; 
const newTitle = '🚀 Updated by Chrome Extension!';

fetch(`https://api.trello.com/1/cards/${cardId}?key=${apiKey}&token=${apiToken}`, {
  method: 'PUT',
  headers: {
    'Accept': 'application/json',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ name: newTitle })
})
.then(res => res.json())
.then(data => console.log('✅ Card updated:', data))
.catch(err => console.error('❌ Error:', err));
