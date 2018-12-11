function OpenEASEController(){
    var activeClient;

    this.executeProlog = function(query, callback) {
        var pl = activeClient.newProlog();
        // Assert package in prolog
        pl.jsonQuery(query, function(queryResult) {
            callback(queryResult);
            pl.finishClient();
        });
    }

    this.registerClient = function(client) {
        activeClient = client;
    }
}