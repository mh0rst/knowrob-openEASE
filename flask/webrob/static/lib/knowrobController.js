function KnowrobClientController() {

    var that = this;

    this.activeClient = undefined;

    this.client_initialized_cb = [];

    this.executeProlog = function (query, callback) {
        var pl = that.activeClient.newProlog();
        // Assert package in prolog
        pl.jsonQuery(query, function (queryResult) {
            callback(queryResult);
            pl.finishClient();
        });
    };

    this.fireInitialized = function (client) {
        that.activeClient = client;
        for (i = 0; i < that.client_initialized_cb.length; i++) {
            that.client_initialized_cb[i](client);
        }
    };

    this.onClientInitialization = function (callback) {
        if (that.activeClient !== undefined) {
            callback(that.activeClient);
        }
        that.client_initialized_cb.push(callback);
    };

    this.setEpisode = function(category, episode) {
        that.activeClient.setEpisode(category, episode);
    };
}