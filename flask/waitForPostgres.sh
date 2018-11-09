#!/bin/bash
# Wait for the postgres port to be available, pass IP/Hostname of the postgres server as argument, followed by the command to execute after postgres is up
echo "Waiting for postgres container..."
until nc -z $1 5432
do
    sleep 1
done
eval "${@:2}"
