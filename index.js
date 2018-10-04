var AWS = require('aws-sdk');

var handler = function(event, context, callback) {
  var dynamodb = new AWS.DynamoDB({
    apiVersion: '2012-08-10',
    endpoint: 'http://dynamodb:8000',
    region: 'us-west-2',
    credentials: {
      accessKeyId: '2345',
      secretAccessKey: '2345'
    }
  });

  var docClient = new AWS.DynamoDB.DocumentClient({
     apiVersion: '2012-08-10',
     service: dynamodb
  });
  
  //////////////////////////////////
  // codigo de la funcion

  let body = JSON.parse(event.body);
  var item = body;

  switch (event.httpMethod) {
    case "GET":
      switch (event.resource) {
        case "/envios/pendientes":
          // scan indice pendientes
          console.log("Buscando Envios pendientes en el Global Index EnviosPendientesIndex");
          var params = {
            TableName: "Envio",
            IndexName: "EnviosPendientesIndex",
            Limit: 10
          };       
          docClient.scan(params, function(err, data) {
            if (err) {
              console.log("error!");
              callback(null, {
                statusCode: 500, body: JSON.stringify(err)  //error response
              });
            } else {
              //callback(null, data.Items);
              callback(null, {
                statusCode: 201,
                body: JSON.stringify(data) //succesful response
              });
              }
            }); 
          break; 
        case "/envios/{idEnvio}":
          let idseleccionado = (event.pathParameters || {}).idEnvio || false;
          // scan indice pendientes
          console.log("Buscando Envios por ID " + idseleccionado);
          var params = {
            TableName: "Envio",
            //IndexName: "EnviosPendientesIndex",
            Limit: 10,
            Key: { "id": idseleccionado }
            };      
          docClient.get(params, function(err, data) {
            if (err) {
              console.log("error!");
              callback(null, {
                statusCode: 500, body: JSON.stringify(err)  //error response
              });
            } else {
              //callback(null, data.Items);
              callback(null, {
                statusCode: 201,
                body: JSON.stringify(data) //succesful response
              });
              }
            }); 
          break; }
      break;
    case "POST":
      switch (event.resource) {
        case "/envios":
          console.log("Creando nuevo envio...");
          // crear
          var newfecha = new Date();
          item.fechaAlta = newfecha.toISOString();
          item.pendiente = item.fechaAlta;
          item.id = guid();
          // Espera los siguientes parametros que faltan del JSON
          /*
          {
          "destino": "Algun Destino",
          "email": "​ algunemail@smgail.com​ "
          }*/
          console.log('item', item);

          docClient.put({
            TableName: 'Envio',
            Item: item
          }, function(err, data) {
            if (err) {
              callback(null, {
                statusCode: 500, body: JSON.stringify(err)
              });
            } else {
              callback(null, {
                statusCode: 201,
                body: JSON.stringify(item)
              });
            }
          });

          break;
        case "/envios/{idEnvio}/movimiento":
          // agregar movimiento
          // 1) traer por id
          let idseleccionado = (event.pathParameters || {}).idEnvio || false;
          console.log("Agregando movimientos al envio x idEnvio " + idseleccionado);
          var params = {
            TableName: "Envio",
            //IndexName: "EnviosPendientesIndex",
            Limit: 10,
            Key: { "id": idseleccionado }
            };
            docClient.get(params, function(err, data) {
              if (err) {
                console.log("error!");
                callback(null, {
                  statusCode: 500, body: JSON.stringify(err)  //error response
                });
              } else {
                //Agregar movimientos si se puede seleccionar por id el envio
                item.fecha = new Date().toISOString();
                var params2 = {
                  TableName: "Envio",
                  //Item: item,
                  Key: { "id": idseleccionado },
                  ConditionExpression: 'attribute_exists(#pendiente)',
                  UpdateExpression: 'set #historial = list_append(if_not_exists(#historial, :empty_list), :movimiento)',
                  ExpressionAttributeNames: {
                    '#historial': 'historial',
                    '#pendiente': 'pendiente'
                  },
                  ExpressionAttributeValues: { 
                    ':movimiento': [item],
                    ':empty_list': []
                  },
                  ReturnValues: 'ALL_NEW'
                };
                docClient.update(params2, function(err, data) {
                  if (err) {
                    callback(null, {
                      statusCode: 500, body: JSON.stringify(err)
                    });
                  } else {
                    callback(null, {
                      statusCode: 201,
                      body: JSON.stringify(item)
                    });
                  }
                });
              



                //callback(null, data.Items);
                callback(null, {
                  statusCode: 201,
                  body: JSON.stringify(data) //succesful response
                });
              }
            }); 
          // 2) agregamos historial
          // 3) put para guardar
          break;
        case "/envios/{idEnvio}/entregado":
          // marcar entregado
          // 1) traer por id
          let idseleccionado2 = (event.pathParameters || {}).idEnvio || false;
          console.log("Marcando como entregado al envio x idEnvio " + idseleccionado2);
          var params = {
            TableName: "Envio",
            //IndexName: "EnviosPendientesIndex",
            Limit: 10,
            Key: { "id": idseleccionado2 }
            };
            docClient.get(params, function(err, data) {
              if (err) {
                console.log("error!");
                callback(null, {
                  statusCode: 500, body: JSON.stringify(err)  //error response
                });
              } else {
                //Agregar movimiento que dice Entregado y fecha actual 
                //Tambien se borra el estado pendiente del envio para el id
                var params = {
                  TableName: "Envio",
                  Key: { "id": idseleccionado2 },
                  UpdateExpression: 'set #historial = list_append(if_not_exists(#historial, :empty_list), :movimiento) remove #pendiente',
                  ExpressionAttributeNames: {
                    '#historial': 'historial',
                    '#pendiente': 'pendiente'
                  },
                  ExpressionAttributeValues: { 
                    ':movimiento': [{fecha: new Date().toISOString(),descripcion:"Entregado"}],
                    ':empty_list': []
                  },
                  ReturnValues: 'ALL_NEW'
                };

                docClient.update(params, function(err, data) {
                  if (err) {
                    callback(null, {
                      statusCode: 500, body: JSON.stringify(err)
                    });
                  } else {
                    callback(null, {
                      statusCode: 201,
                      body: JSON.stringify(item)
                    });
                  }
                });
        
                //callback(null, data.Items);
                callback(null, {
                  statusCode: 201,
                  body: JSON.stringify(data) //succesful response
                });
              }
            }); 
          // 2) borrar atributo pendiente
          // 3) put para guardar
          break;
      }
      break;
    default:
      callback(null, {
        statusCode: 405
      });
  }

}


function guid() {
  function s4() {
    return Math.floor((1 + Math.random()) * 0x10000)
      .toString(16)
      .substring(1);
  }
  return s4() + s4() + '-' + s4() + '-' +
    s4() + '-' + s4() + '-' + s4() + s4() + s4();
}

exports.handler = handler;


