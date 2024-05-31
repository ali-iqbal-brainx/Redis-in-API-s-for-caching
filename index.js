import express from 'express';
import { createClient } from 'redis';
import fetch from 'node-fetch';

const PORT = 3000;
const REDIS_PORT = 6379;

// Initialize Redis client
const client = createClient({
    url: `redis://localhost:${REDIS_PORT}`
});

// Event listeners for Redis client
client.on('connect', () => {
    console.log('Connected to Redis...');
});

client.on('ready', () => {
    console.log('Redis client ready');
});

client.on('error', (err) => {
    console.error(`Redis error: ${err}`);
});

client.on('end', () => {
    console.log('Redis connection closed');
});

// Connect the Redis client
await client.connect();

const app = express();

//set response
function setResponse(username, repos) {
    return `<h2>${username} has ${repos} Github repos</h2>`;
}

//set error response 
function setErrorResponse(error) {
    return `<h2>${error}</h2>`;
}

async function getRepos(req, res) {
    try {
        const { username } = req.params;

        const response = await fetch(`https://api.github.com/users/${username}`);

        if (!response) {
            return res.send(setErrorResponse("Data not found"));
        }

        const data = await response.json();

        const repos = data?.public_repos + '';

        //set data to redis
        await client.set(username, repos, {
            EX: 3600,
            NX: true
        });
        console.log("Data stored in cache");

        return res.send(setResponse(username, repos.toString()));

    } catch (err) {
        console.log(err);
        return res.send(setErrorResponse(err));
    }
}

//cache middleware
async function cache(req, res, next) {
    const { username } = req.params;

    try {
        const data = await client.get(username);

        if (data !== null) {
            console.log("Data returning from cache");
            return res.send(setResponse(username, data));
        } else {
            next();
        }
    } catch (err) {
        return res.send(setErrorResponse("Redis Error"));
    }

}

app.get('/repos/:username', cache, getRepos);

app.listen(PORT, () => {
    console.log(`App listening on port at http://localhost:${PORT}`);
});
