var SwaggerClient = require('swagger-client');

var onSwagger = function() {
    swagger.setHost("./"); // override Swagger's spec for host
    console.log("swagger loaded");

    swagger.apis.help();
    swagger.apis.default.get_auth.help();

    var responseContentType = {
        responseContentType: 'application/json'
    };
    return;
    swagger.default.get_auth(authParams, responseContentType, function(response) {
        console.log("onValidated", response);
        onValidated(response.obj);
    });
};

// initialize swagger
var swagger = new SwaggerClient({
    url: "./swagger.json",
    success: onSwagger
});