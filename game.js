const serverInput = document.querySelector('#serverUrl') || Object.assign(document.createElement('input'), { id: 'serverUrl', type: 'text', value: '' });
// Keep the server URL field visible so the user can connect to Render or any backend.
if (!serverInput.isConnected) document.body.appendChild(serverInput);
try {
  const saved = localStorage.getItem('rannabatiServerUrl');
  if (saved) serverInput.value = saved;
  else if (inviteServerUrl) serverInput.value = inviteServerUrl;
} catch {}
