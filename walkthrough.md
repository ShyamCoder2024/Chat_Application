# Walkthrough - Block/Unblock Chat Visibility

## Problem
Previously, blocking a user did not remove them from the chat list. The user wanted blocked users to disappear from the chat list and reappear only when unblocked.

## Solution
I implemented backend filtering and frontend state updates to achieve this behavior.

### Backend Changes
Modified `server/routes/chat.js` to filter out chats involving blocked users in the `GET /api/chats/:userId` endpoint.

```javascript
// server/routes/chat.js
const currentUser = await User.findById(req.params.userId);
const blockedUserIds = new Set(currentUser.blockedUsers.map(id => id.toString()));

// ... inside the loop ...
if (otherUser) {
    // Skip if this user is blocked
    if (blockedUserIds.has(otherUser._id.toString())) {
        continue;
    }
    // ...
}
```

### Frontend Changes
Updated `client/src/pages/ChatLayout.jsx`:

1.  **Immediate Removal:** When a user is blocked, the chat is immediately removed from the local `chats` state.
    ```javascript
    // handleBlockUser
    setChats(prev => prev.filter(c => c.id !== activeChat.id));
    ```

2.  **Auto-Refresh on Unblock:** Added a dependency on `view` to the `fetchChats` effect. When the user navigates back to the 'chats' view (e.g., after unblocking someone in the Profile section), the chat list is re-fetched, bringing back the unblocked user.
    ```javascript
    useEffect(() => {
        if (view === 'chats') {
            fetchChats();
        }
    }, [user, view]);
    ```

## Verification
- **Scenario 1:** User blocks a contact.
    - Result: The chat immediately disappears from the list and the user is returned to the main view.
- **Scenario 2:** User goes to Profile -> Blocked Users and unblocks the contact.
    - Result: When the user navigates back to the main chat list, the unblocked contact reappears.

This ensures a smooth and intuitive experience for managing blocked contacts.
