//jshint esversion:6

require('dotenv').config();
const express = require("express");
const bodyParser = require("body-parser");
const ejs = require("ejs");
const session = require("express-session");
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const findOrCreate = require('mongoose-findorcreate')
// const bcrypt = require("bcrypt");
// const saltRounds = 10;

const mongoose = require("mongoose");

const app = express();

app.set('view engine', 'ejs');
app.use(express.static("public"));
app.use(bodyParser.urlencoded({ extended: true }));

app.use(session({
    secret: "Our little secret.",
    resave: false,
    saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());

mongoose.connect("mongodb://127.0.0.1/userDB", { useNewUrlParser: true });

/////////////////Creating userSchema////////////////
const userSchema = new mongoose.Schema({
    email: String,
    password: String,
    googleId: String,
    secret: String
});

/////////////// Mongoose plugin that simplifies building username and password login with Passport./////////
userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);

/////////////////Creating userSchema Model////////////////
const User = new mongoose.model("User", userSchema);

//////////Simplified Passport/Passport-Local Configuration////////
passport.use(User.createStrategy());

/////This works for only authentication type 'local' ////////////
// passport.serializeUser(User.serializeUser());
// passport.deserializeUser(User.deserializeUser());

//////Authentication for any type : ///////////
passport.serializeUser(function (user, cb) {
    process.nextTick(function () {
        return cb(null, {
            id: user.id,
            username: user.username
        });
    });
});

passport.deserializeUser(function (user, cb) {
    process.nextTick(function () {
        return cb(null, user);
    });
});

///////////passport-google-oauth20//////
passport.use(new GoogleStrategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: "http://localhost:3000/auth/google/secrets",
    userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo"
},
    function (accessToken, refreshToken, profile, done) {
        User.findOrCreate({ username: profile.displayName, googleId: profile.id }, function (err, user) {
            return done(err, user);
        });
    }
));

app.get("/", function (req, res) {
    res.render("home");
});

/////Authenticate using google strategy and return their email id and google profile//////
app.get("/auth/google",
    passport.authenticate("google", { scope: ["profile"] })     /////Will bring pop up for users to sign in into google account//
);

app.get("/auth/google/secrets",                                         ////After user chooses profile.//
    passport.authenticate("google", { failureRedirect: "/login" }),
    function (req, res) {
        // Successful authentication, redirect to secrets.
        res.redirect("/secrets");
    });

app.route("/login")

    .get(function (req, res) {
        res.render("login");
    })

    .post(function (req, res) {
        const user = new User({
            username: req.body.username,
            password: req.body.password
        });

        req.login(user, function (err) {
            if (err) {
                console.log(err);
                console.log("Not found");
            } else {
                passport.authenticate("local")(req, res, function () {
                    res.redirect("/secrets");
                });
            }

        });
    });

app.route("/register")

    .get(function (req, res) {
        res.render("register");
    })

    .post(function (req, res) {
        try {
            User.register({ username: req.body.username }, req.body.password).then(function (user) {
                if (!user) {
                    console.log(err);
                    console.log("Nh");
                    res.redirect("/register");
                } else {
                    passport.authenticate("local")(req, res, function () {
                        res.redirect("/secrets");
                    });
                }
            });
        } catch (err) {
            console.log(err);
        }
    });

app.get("/secrets", function (req, res) {
    try {
        User.find({ "secret": { $ne: null } }).then(function (foundUsers) {
            if (foundUsers) {
                res.render("secrets", { usersWithSecrets: foundUsers })
            }
        });
    } catch (err) {
        console.log(err);
    }
});

app.get("/submit", function (req, res) {
    if (req.isAuthenticated()) {
        res.render("submit")
    } else {
        res.redirect("/login")
    }
});

app.post("/submit", function (req, res) {
    const submittedSecret = req.body.secret;
    console.log(req.user);

    //Once the user is authenticated and their session gets saved, their user details are saved to req.user.
    // console.log(req.user.id);

    try {
        User.findById(req.user.id).then(function (foundUser) {
            if (foundUser) {
                console.log(foundUser);
                foundUser.secret = submittedSecret;
                foundUser.save().then(() => {
                    res.redirect("/secrets");
                });
            } else {
                console.log(err);
            }
        });
    } catch (err) {
        console.log(err);
    }
});




app.get("/logout", function (req, res) {
    req.logout(function (err) {
        if (err) { return next(err); }
        res.redirect('/');
    });
});

app.listen("3000", function (req, res) {
    console.log("Server started on port 3000");
});











//////////////Manual method of app.post for login route using bodyparser etc////////
// .post(function(req,res){
    // const username = req.body.username;
    // const password = req.body.password;
    // try{
    //     User.findOne({email: username}).then((foundUser) => {
    //         if (foundUser){
    //             bcrypt.compare(password, foundUser.password).then(function(result) {
    //                 if(result===true){
    //                     res.render("secrets");
    //                 }
    //             });
    //         }else{
    //             console.log("Please enter correct username and password")
    //         }
    //     });
    //     }catch(err){
    //         console.log(err);
    //     }
// });

///////// Manual method of app.post for register route using bodyparser etc//////
// .post(function (req, res) {

//     bcrypt.hash(req.body.password, saltRounds).then(function(hash){
//         const newUser = new User({
//             email: req.body.username,
//             password: hash    ////converting plain text to hash
//         });
//         try {
//             newUser.save().then(() => {
//                 res.render("secrets");
//             });
//         } catch (err) {
//             console.log(err);
//         }
//     });
// });
