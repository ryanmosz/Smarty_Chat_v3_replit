const userQuery = 'What did I say about project deadlines?';
const context = await fetchRelevantPosts(userId, userQuery);
const response = await generateResponse(context, userQuery);
console.log(response);

