"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
var express_1 = require("express");
var cors_1 = require("cors");
var mongodb_1 = require("mongodb");
var dotenv_1 = require("dotenv");
var jsonwebtoken_1 = require("jsonwebtoken");
dotenv_1.default.config();
var app = (0, express_1.default)();
var port = process.env.PORT || 8080;
var cosmosDbUri = process.env.COSMOS_DB_URI;
var secretKey = process.env.JWT_SECRET;
var corsOptions = {
    origin: [],
    methods: 'POST',
    credentials: true,
};
if (process.env.NODE_ENV === 'development') {
    corsOptions.origin = ['http://localhost:8080', 'http://127.0.0.1:8080']; // Allow localhost in development
}
else if (process.env.NODE_ENV === 'production') {
    corsOptions.origin = ['https://ashy-ocean-0062f3f00.5.azurestaticapps.net']; // Allow only your production domain
}
app.use((0, cors_1.default)(corsOptions));
app.options('*', (0, cors_1.default)(corsOptions));
app.use(express_1.default.json());
if (!cosmosDbUri) {
    throw new Error('COSMOS_DB_URI is not defined in the environment variables.');
}
var client = new mongodb_1.MongoClient(cosmosDbUri);
client.connect().then(function () {
    var db = client.db('JRFBLogin');
    var usersCollection = db.collection('Usernames');
    var recordsCollection = db.collection('Records');
    app.post('/login', function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
        function sanitizeUsername(username) {
            var sanitized = username.trim().toLowerCase();
            if (sanitized.length < 3 || sanitized.length > 20) {
                throw new Error('Invalid username length. Must be between 3 and 20 characters.');
            }
            if (/^[a-z.]+$/.test(sanitized)) {
                return sanitized;
            }
            throw new Error('Invalid username. Only letters and full stops are allowed');
        }
        var username, sanitizedUsername, user, token, error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    username = req.body.username;
                    sanitizedUsername = sanitizeUsername(username);
                    return [4 /*yield*/, usersCollection.findOne({ username: sanitizedUsername })];
                case 1:
                    user = _a.sent();
                    if (!user) {
                        return [2 /*return*/, res.status(401).json({ success: false, message: 'Authentication failed' })];
                    }
                    token = jsonwebtoken_1.default.sign({ username: user.sanitizedUsername }, secretKey, { expiresIn: '1h' });
                    return [2 /*return*/, res.status(200).json({ success: true, token: token })];
                case 2:
                    error_1 = _a.sent();
                    console.error('Error:', error_1);
                    res.status(500).json({ success: false, message: 'An error occurred' });
                    return [3 /*break*/, 3];
                case 3: return [2 /*return*/];
            }
        });
    }); });
    app.post('/submit', function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
        var _a, timestamp, name, operational, activity, result, error_2;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _a = req.body, timestamp = _a.timestamp, name = _a.name, operational = _a.operational, activity = _a.activity;
                    _b.label = 1;
                case 1:
                    _b.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, recordsCollection.insertOne({
                            timestamp: timestamp,
                            name: name,
                            operational: operational,
                            activity: activity
                        })];
                case 2:
                    result = _b.sent();
                    res.status(200).json({ message: 'Data submitted successfully', result: result });
                    return [3 /*break*/, 4];
                case 3:
                    error_2 = _b.sent();
                    console.error('Error submitting data', error_2);
                    res.status(500).json({ message: 'Failed to submit data' });
                    return [3 /*break*/, 4];
                case 4: return [2 /*return*/];
            }
        });
    }); });
    app.post('/api/names', function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
        var query, names, error_3;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    query = req.body.query;
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, usersCollection.find({ username: { $regex: query, $options: 'i' } }, // Use regex for case-insensitive search
                        { projection: { username: 1, _id: 0 } } // Only return the username field
                        ).toArray()];
                case 2:
                    names = _a.sent();
                    res.status(200).json(names);
                    return [3 /*break*/, 4];
                case 3:
                    error_3 = _a.sent();
                    console.error('Error fetching names', error_3);
                    res.status(500).json({ message: 'Failed to fetch names' });
                    return [3 /*break*/, 4];
                case 4: return [2 /*return*/];
            }
        });
    }); });
    app.listen(port, function () {
        console.log("Server is running on port ".concat(port));
    });
}).catch(function (err) {
    console.error('Failed to connect to database:', err);
});
