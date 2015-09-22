/**
 * λ Delete user
 * →λ path DELETE /users/{userId}
 * →λ event.pathparam.userId {string} - Users id
 * λ→ response {} 200 - User deleted
 */
exports.handler = function(event, context) {
  var err = null, 
  	response = {};

  context.done(err, response);
};
