REQUIREMENTS
DONE - Authentication - DONE
DONE - Real-time messaging - DONE
DONE - Channel/DM organization - DONE
DONE - File sharing & search - DONE
DONE - User presence, & status - DONE
DONE - Thread support - DONE
NON-WORKING IMPLEMENTATION - Emoji reactions 

Limitations:
1: there is no heartbeat system to check for user presence. Presence is only updated when the user updates it, or if they manually log out. 
2: there is an emoji picker attached to each message, but there will be a non fatal "error to add" when a user tries to add an emoji reaction to a message. 
