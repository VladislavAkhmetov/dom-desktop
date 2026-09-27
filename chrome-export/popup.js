document.querySelector('#export').addEventListener('click', async () => {
  try {
    const windows = await chrome.windows.getAll({ populate: true, windowTypes: ['normal'] })
    const data = { version: 1, exportedAt: new Date().toISOString(), windows: windows.map((window, index) => ({ name: `Окно Chrome ${index + 1}`, tabs: window.tabs.filter(tab => /^https?:\/\//i.test(tab.url || '')).map(tab => ({ url: tab.url, title: tab.title, pinned: tab.pinned, groupId: tab.groupId })) })) }
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }))
    const link = document.createElement('a'); link.href = url; link.download = 'dom-tabs.json'; link.click()
    document.querySelector('#status').textContent = 'Файл сохранён. В Доме выберите «Перенести вкладки».'
    setTimeout(() => URL.revokeObjectURL(url), 10000)
  } catch (error) { document.querySelector('#status').textContent = error.message }
})
