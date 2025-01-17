REQUIREMENTS

WEEK 2

feature add:

A RAG (Retrieval-Augmented Generation) system that can interact with the channel portion of my Slack clone workspace.

bugs:

currently the tool chain is not set up correctly, so the user does not recieve any answer to their query on the #askGPT channel

--

WEEK 1
1: Authentication - DONE

2: Real-time messaging - DONE

3: Channel/DM organization - DONE

4: File sharing & search - DONE

5: User presence, & status - DONE

6: Thread support - DONE

7: Emoji reactions - NON-WORKING IMPLEMENTATION 



Limitations:

1: there is no heartbeat system to check for user presence. Presence is only updated when the user updates it, or if they manually log in or out. 

2: there is an emoji picker attached to each message, but there will be a non fatal "error to add" when a user tries to add an emoji reaction to a message. 
