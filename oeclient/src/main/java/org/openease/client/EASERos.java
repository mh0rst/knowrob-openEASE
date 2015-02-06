package org.openease.client;

import java.io.IOException;
import java.net.URI;
import java.net.URISyntaxException;

import javax.net.ssl.SSLContext;
import javax.websocket.ClientEndpoint;
import javax.websocket.ContainerProvider;
import javax.websocket.DeploymentException;
import javax.websocket.WebSocketContainer;

import org.glassfish.grizzly.ssl.SSLEngineConfigurator;
import org.glassfish.tyrus.client.ClientManager;

import edu.wpi.rail.jrosbridge.Ros;

/**
 * Extension of rosbridge implementation to specify custom web socket URL.
 * 
 * @author Moritz Horstmann <mhorst@cs.uni-bremen.de>
 *
 */
@ClientEndpoint
public class EASERos extends Ros {
    private final String url;
    private SSLContext sslContext = null;

    /**
     * Create a new ROS handle with given web socket URL.
     * 
     * @param url
     */
    public EASERos(String url) {
        this.url = url;
    }

    @Override
    public String getURL() {
        return this.url;
    }

    @Override
    public boolean connect() {
        throw new UnsupportedOperationException(
                "Connect on ros instance is not supported, use connect on EASEClient instance");
    }

    /**
     * Intentionally package private connect method to prevent users from using this directly. Direct usage would result
     * in authentication errors with openEASE.<br />
     * This is copied from jrosbridge original Ros.java to also implement custom SSL handling.
     */
    boolean connectInternal() {
        try {
            // create a WebSocket connection here
            URI uri = new URI(this.getURL());
            WebSocketContainer container = ContainerProvider.getWebSocketContainer();
            if (sslContext != null && container instanceof ClientManager) {
                // Set the tyrus web socket client implementation to use our own SSLContext, if specified.
                SSLEngineConfigurator conf = new SSLEngineConfigurator(sslContext, true, false, false);
                ((ClientManager) container).getProperties().put("org.glassfish.tyrus.client.sslEngineConfigurator",
                        conf);
            }
            container.connectToServer(this, uri);
            return true;
        } catch (DeploymentException | URISyntaxException | IOException e) {
            // failed connection, return false
            System.err.println("[ERROR]: Could not create WebSocket: " + e.getMessage());
            return false;
        }
    }

    /**
     * Sets the SSLContext for the web socket implementation.
     * 
     * @param sslContext
     *            SSLContext
     */
    void setSSLContext(SSLContext sslContext) {
        this.sslContext = sslContext;
    }
}
