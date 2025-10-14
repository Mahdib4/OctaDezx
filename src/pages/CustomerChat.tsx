<Input
  value={newMessage}
  onChange={(e) => setNewMessage(e.target.value)}
  placeholder="Type your message..."
  onKeyDown={(e) => {
    if (e.key === 'Enter' && !e.shiftKey && !loading) {
      e.preventDefault();
      sendMessage();
    }
  }}
  className="h-12 bg-gray-700 border-gray-600 text-white rounded-lg pl-4 pr-12 w-full focus:border-blue-500 transition-colors"
  disabled={loading}
/>
