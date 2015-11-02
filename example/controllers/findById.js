/**
 * λ Get user
 * →λ path GET /users
 * →λ event.query.userId {string} - Users id
 * λ→ response object{} 200 - User returned
 * λ→ response {} 404 - User not found
 * λ→ required response.name
 */
exports.handler = function(event, context) {
  var err = null, 
  	response = { test: "123" };

  context.done(err, response);
};
