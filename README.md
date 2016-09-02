# Swaggerd

Swaggerd is a Node.js framework that allows the developer to focus on the act of writing REST endpoints to solve project requirements. The idea is to automate as much as possible, in a way that is natural to the Node ecosystem and not to constrain the developer as much as possible.

By default, the Swaggerd-cli expects a [swagger.json](https://github.com/Swaggerd/swaggerd/blob/master/example/swagger.json) file in the root of the project. For information on layout, see the Swagger [specification](http://swagger.io/specification/). 

## Setup

Swaggerd cli command “setup” (`swaggerd setup`) will auto generate a controller for each endpoint listed in swagger.json, including a stub function and simple documentation. It will also update the documentation on an existing/modified controller when the api spec changes. An example of a generated controller:

```javascript
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
```

The documentation includes both the expected input as well as the expected output as listed in the spec.

## Run

Using the command `swagger run` will start a webserver that hosts static content in a root “/public” directory and handles requests against the API.

For more help on the CLI, use `swagger help` to get more information.
