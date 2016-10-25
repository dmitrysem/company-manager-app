var http = require('http');
var fs = require('fs');
var url = require('url');

var config = JSON.parse(process.env.APP_CONFIG);
var port = process.env.PORT;

var mongo = require('mongodb').MongoClient;
var ObjectId = require('mongodb').ObjectId;
//var urlDB = 'mongodb://localhost:27017/company-manager-db';
var urlDB = 'mongodb://' + config.mongo.user + ':mypass@' + config.mongo.hostString;

var server = http.createServer(function(req, res) {
    var urlParsed = url.parse(req.url, true);

    switch (urlParsed.pathname) {
        case '/':
            sendFile('./index.html', res);
            break;
        case '/index.html':
        case '/app.js':
            sendFile('.' + urlParsed.pathname, res);
            break;
        case '/companies':
            processRequest(urlParsed.query, req, res);
            break;
        default:
            res.statusCode = 404;
            res.end('Page Not Found');
            break;
    }
}).listen(port);

// ---

function sendFile(filePath, res) {
    var file = fs.createReadStream(filePath);
    file.pipe(res);

    file.on('error', function() {
        res.statusCode = 500;
        res.end('Server Error');
    });

    res.on('close', function() {
        file.destroy();
    });
}

function processRequest(query, req, res) {
    mongo.connect(urlDB, function(err, db) {
        if (err) return res.statusCode = 500 && res.end();

        var companies = db.collection('companies');

        // ---for testing purposes---
        /*companies.deleteMany({}, function(err, result) {
            if (err) throw err;
            console.log(result);

            db.close();
            res.end();
        });
        return;*/

        switch (req.method) {
            case 'POST':
                responseToPOST(db, companies, req, res);
                break;
            case 'PUT':
                responseToPUT(db, companies, req, res, query);
                break;
            case 'DELETE':
                responseToDELETE(db, companies, res, query);
                break;
            case 'GET':
                responseToGET(db, companies, res);
                break;
        }
    });
}

function responseToPOST(db, companies, req, res) {
    var reqBody = '';

    req.on('data', function(chunk) {
        reqBody += chunk;
    });

    req.on('end', function() {
        var reqBodyParsed = JSON.parse(reqBody);

        companies.insertOne(reqBodyParsed, function(err, result) {
            db.close();
            if (err) return res.statusCode = 500 && res.end();

            console.log('New doc was successfully added to collection');
            reqBodyParsed._id = result.insertedId;
            var resBody = JSON.stringify(reqBodyParsed);

            res.setHeader('Content-Type', 'application/json');
            res.end(resBody);
        });
    });
}

function responseToPUT(db, companies, req, res, query) {
    var reqBody = '';

    req.on('data', function(chunk) {
        reqBody += chunk;
    });

    req.on('end', function() {
        var reqBodyParsed = JSON.parse(reqBody);
        delete reqBodyParsed._id;

        companies.updateOne(
            { _id: ObjectId(query.id) },
            { $set: reqBodyParsed }, function(err, result) {
                db.close();
                if (err) return res.statusCode = 500 && res.end();

                console.log('Doc was successfully updated in collection');
                res.end();
            }
        );
    });
}

function responseToDELETE(db, companies, res, query) {
    companies.deleteOne({ _id: ObjectId(query.id) }, function(err, result) {
        db.close();
        if (err) return res.statusCode = 500 && res.end();

        console.log('Doc was successfully removed from collection');
        res.end();
    });
}

function responseToGET(db, companies, res) {
    companies.count(function(err, count) {
        // if there is no collection -
        //      create it, set index and fill with init. data from json file
        if (!count) {
            companies.createIndex({ 'name': 1 }, { unique: true }, function(err, result) {
                var file = fs.createReadStream('./companies.json');
                var json = '';

                file.on('readable', function(data) {
                    var chunk = file.read();
                    if (!chunk) return;
                    json += chunk;
                });

                file.on('end', function() {
                    var jsonParsed = JSON.parse(json);

                    companies.insertMany(jsonParsed, function(err, result) {
                        if (err) console.log('Something wrong with insert docs from file');

                        console.log('New docs (from json file) were successfully added to collection');
                        returnAllDocuments();
                    });
                });

                file.on('error', function() {
                    res.statusCode = 500;
                    res.end('Server Error');
                });

                res.on('close', function() {
                    file.destroy();
                });
            });
        } else {
            returnAllDocuments();
        }
    });

    // ---
    function returnAllDocuments() {
        companies.find().toArray(function(err, documents) {
            db.close();
            if (err) return res.statusCode = 500 && res.end();

            var resBody = JSON.stringify(documents);

            res.setHeader('Content-Type', 'application/json');
            res.end(resBody);
        });
    }
}