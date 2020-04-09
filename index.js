const http = require('http')
const httpProxy = require('http-proxy')
const express = require('express')
const request = require('request')
const httpsrv = require('httpsrv')
const fs = require('fs')
const SECRET = /rpc-secret=(.*)/.exec(
	fs.readFileSync('aria2c.conf', 'utf-8')
)[1]
const ENCODED_SECRET = Buffer.from(SECRET).toString('base64')

const PORT = process.env.PORT || 1234
const app = express()
const proxy = httpProxy.createProxyServer({
	target: 'ws://localhost:6800',
	ws: true
})
const server = http.createServer(app)

// Proxy websocket
server.on('upgrade', (req, socket, head) => {
	proxy.ws(req, socket, head)
})

// Handle normal http traffic
app.use('/jsonrpc', (req, res) => {
	req.pipe(request('http://localhost:6800/jsonrpc')).pipe(res)
})
app.use(
	'/downloads/' + ENCODED_SECRET,
	httpsrv({
		basedir: __dirname + '/downloads'
	})
)
app.use('/ariang', express.static(__dirname + '/ariang'))
app.get('/', (req, res) => {
	res.send(`
<!DOCTYPE html>
<html>
<script type="text/javascript">function ok(){
	open('/ariang/#!/settings/rpc/set/wss/'+location.hostname+'/443/jsonrpc/'+btoa(secret.value),'_blank')
}</script>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, shrink-to-fit=no">
    <title>Untitled</title>
    <link rel="stylesheet" href="https://raw.githubusercontent.com/anandu467/heroku-aria2c/master/ariang/assets/bootstrap/css/bootstrap.min.css">
    <link rel="stylesheet" href="https://raw.githubusercontent.com/anandu467/heroku-aria2c/master/ariang/assets/fonts/fontawesome-all.min.css">
    <link rel="stylesheet" href="https://raw.githubusercontent.com/anandu467/heroku-aria2c/master/ariang/assets/css/styles.min.css">
</head>

<body>
    <div class="login-clean">
        <form method="post">
            <h2 class="sr-only">Login Form</h2>
            <div class="illustration"><i class="fas fa-user-circle"></i>
                <h1 style="font-size: 20px;">Welcome Anandu</h1>
            </div>
            <div class="form-group">

<input type="password" class="form-control" name="password" placeholder="Password" id="secret" /></div>
            <div class="form-group"><button class="btn btn-primary btn-block" id="panel" onclick=ok()>Log In</button></div>
        </form>
    </div>
    <script src="https://raw.githubusercontent.com/anandu467/heroku-aria2c/master/ariang/assets/js/jquery.min.js"></script>
    <script src="https://raw.githubusercontent.com/anandu467/heroku-aria2c/master/ariang/assets/bootstrap/js/bootstrap.min.js"></script>
</body>

</html>
`)
})
server.listen(PORT, () => console.log(`Listening on http://localhost:${PORT}`))

if (process.env.HEROKU_APP_NAME) {
	const readNumUpload = () =>
		new Promise((res, rej) =>
			fs.readFile('numUpload', 'utf-8', (err, text) =>
				err ? rej(err) : res(text)
			)
		)
	const APP_URL = `https://${process.env.HEROKU_APP_NAME}.herokuapp.com`
	const preventIdling = () => {
		request.post(
			'http://localhost:6800/jsonrpc',
			{
				json: {
					jsonrpc: '2.0',
					method: 'aria2.getGlobalStat',
					id: 'preventIdling',
					params: [`token:${SECRET}`]
				}
			},
			async (err, resp, body) => {
				console.log('preventIdling: getGlobalStat response', body)
				const { numActive, numWaiting } = body.result
				const numUpload = await readNumUpload()
				console.log(
					'preventIdling: numbers',
					numActive,
					numWaiting,
					numUpload
				)
				if (
					parseInt(numActive) +
						parseInt(numWaiting) +
						parseInt(numUpload) >
					0
				) {
					console.log('preventIdling: make request to prevent idling')
					request(APP_URL)
				}
			}
		)
		setTimeout(preventIdling, 15 * 60 * 1000) // 15 min
	}
	preventIdling()
}
