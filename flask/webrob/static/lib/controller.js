function OpenEASEController() {

    var that = this;

    this.uninitializedClient = undefined;

    this.options = undefined;

    this.initializeWhenReady = false;

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

    this.registerClient = function (client) {
        that.uninitializedClient = client;
        tryInitialization();
    };

    this.prepareClientInitialization = function (options) {
        that.options = options;
        tryInitialization();
    };

    // Initializes the client when ready.
    this.initializeClient = function () {
        that.initializeWhenReady = true;
        tryInitialization();
    };

    function tryInitialization() {
        if(that.uninitializedClient && that.options && that.initializeWhenReady) {
            that.uninitializedClient.setOptions(that.options, that.fireInitialized);
            that.uninitializedClient.init();
            that.uninitializedClient = undefined;
            that.options = undefined;
            that.initializeWhenReady = false;
        }
    }

    this.fireInitialized = function () {
        that.activeClient = that.uninitializedClient;
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
}