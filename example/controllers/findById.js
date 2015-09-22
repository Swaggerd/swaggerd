/**
 * λ Get user
 * →λ path GET /users/{userId}
 * →λ event.pathparam.userId {string} - Users id
 * λ→ response object{} 200 - User returned
 * λ→ response {} 404 - User not found
 * λ→ required response.name
 */
exports.handler = function(event, context) {
  var err = null, 
  	response = {};

  context.done(err, response);
};
