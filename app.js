const express = require('express')
const session = require('express-session')
const mongoose = require('mongoose')
const app = express();
const methodOverride = require('method-override')
const ejsMate = require("ejs-mate")
const bcrypt = require("bcrypt")
const catchAsync = require("./utils/catchAsync")
const ExpressError = require("./utils/ExpressError")
const path = require('path');

// MODELS
const BrandModels = require('./models/brandModels');
const ProductModels = require('./models/productModels');
const UserModels = require('./models/userModels');
const ContentModels = require('./models/contentModels');

app.engine('ejs', ejsMate)
app.set('view engine', 'ejs')
mongoose.set('strictQuery', false);
app.set('views', path.join(__dirname, 'views'))

app.use(express.urlencoded({ extended: true }))
app.use(methodOverride('_method'))
app.use(session({ secret: 'notagoodsecret' }))
app.use(function (req, res, next) {
    res.locals.user_id = req.session.user_id;
    res.locals.user_role = req.session.user_role;
    res.locals.user_fname = req.session.user_fname;
    next();
});

// db connection
async function main() {
    try {
        await mongoose.connect('mongodb://localhost:27017/sun21-db')
        console.log("Mongo Connection Open")
    } catch (err) {
        console.log("Oops.. Connection Error")
    }
} main()
const msgAdminOnly = "Akses Ditolak! Hanya dapat diakses oleh admin"
// home
app.get('/', catchAsync(async (req, res) => {
    const getContent = await ContentModels.find({})
    res.render("home/index", { getContent })
}))
app.get('/addContent', (req, res) => {
    if (req.session.user_role == 1) {
        res.render("home/add")
    }
    throw new ExpressError(msgAdminOnly, 999)
})
app.post('/addContent', catchAsync(async (req, res) => {
    const newContent = new ContentModels(req.body.content)
    await newContent.save()
    res.redirect("/")
}))
app.get('/detail/:id', catchAsync(async (req, res) => {
    const getContent = await ContentModels.findById(req.params.id)
    res.render("home/detail", { getContent })
}))

app.get('/whyUs', (req, res) => {
    res.render("whyUs")
})
app.get('/aboutUs', (req, res) => {
    res.render("aboutUs")
})
// brand
app.get('/brand', catchAsync(async (req, res) => {
    const getBrand = await BrandModels.find({})
    res.render("brand/index", { getBrand })
}))
app.get('/brand/add', (req, res) => {
    if (req.session.user_role == 1) {
        res.render("brand/add")
    }
    res.send(msgAdminOnly)
})
app.post('/brand', catchAsync(async (req, res) => {
    const newBrand = new BrandModels(req.body.brand)
    await newBrand.save()
    res.redirect("/brand")
}))
app.put('/brand/brandEdit/:id', catchAsync(async (req, res) => {
    const { id } = req.params
    await BrandModels.findByIdAndUpdate(id, { ...req.body.brand })
    res.redirect("back")
}))
app.delete('/brand/brandDelete/:id', catchAsync(async (req, res) => {
    const { id } = req.params
    await BrandModels.findByIdAndDelete(id)
    res.redirect("/brand")
}))
// product
app.get('/brand/:id', catchAsync(async (req, res, next) => {
    const { id } = req.params
    const getBrand = await BrandModels.findById(id)
    const getProduct = await ProductModels.find({ productStatus: 1, brandID: id })
    const getProductInactive = await ProductModels.find({ productStatus: 0, brandID: id })
    res.render("product/index", { getBrand, getProduct, getProductInactive })
}))
app.get('/brand/productEdit/:id', catchAsync(async (req, res) => {
    if (req.session.user_role == 1) {
        const { id } = req.params
        const getProduct = await ProductModels.findById(id)
        const getBrand = await BrandModels.findById(getProduct.brandID)
        res.render("product/edit", { getProduct, getBrand })
    }
    res.send(msgAdminOnly)
}))
app.post('/brand/productAdd/:id', catchAsync(async (req, res) => {
    const newProduct = new ProductModels(req.body.product)
    await newProduct.save()
    res.redirect("back")
}))
app.put('/brand/productEdit/:id', catchAsync(async (req, res) => {
    const { id } = req.params
    const updatedProduct = await ProductModels.findByIdAndUpdate(id, { ...req.body.product })
    res.redirect(`/brand/${updatedProduct.brandID}`)
}))
app.delete('/brand/productDelete/:id', catchAsync(async (req, res) => {
    const { id } = req.params
    const deletedProduct = await ProductModels.findById(id)
    await ProductModels.findByIdAndDelete(id)
    res.redirect(`/brand/${deletedProduct.brandID}`)
}))
// contact
app.get('/contact', (req, res) => {
    res.render("contact/index")
})
app.post('/registerAdm', catchAsync(async (req, res) => {
    const { username, password, email, phone, address, fullname } = req.body.user
    const validateUsername = await UserModels.findOne({ username })
    if (!validateUsername) {
        const hash = await bcrypt.hash(password, 12)
        const newUser = new UserModels({ username, password: hash, fullname, email, phone: `+62${phone}`, address, role: 1 })
        await newUser.save()
        res.render('contact/registerSuccess')
    } else {
        throw new ExpressError('Username telah terdaftar', 999)
    }
}))

// account
app.get('/account/:id', async (req, res) => {
    const { id } = req.params
    const sessionId = req.session.user_id
    if (sessionId == id) {
        const getUser = await UserModels.findById(id)
        res.render("account/detail", { getUser })
    } else {
        throw new ExpressError('Akun tidak ditemukan', 999)
    }
})
app.get('/register', (req, res) => {
    res.render("account/register")
})
app.post('/register', catchAsync(async (req, res) => {
    const { username, password, email, phone, address, fullname } = req.body.user
    const validateUsername = await UserModels.findOne({ username })
    if (!validateUsername) {
        const hash = await bcrypt.hash(password, 12)
        const newUser = new UserModels({ username, password: hash, fullname, email, phone: `+62${phone}`, address, role: 2 })
        const userData = await newUser.save()
        req.session.user_id = userData._id
        req.session.user_role = 2
        req.session.user_fname = userData.fullname
        res.redirect(`/account/${userData._id}`)
    } else {
        throw new ExpressError('Username telah terdaftar', 999)
    }
}))
app.post('/login', catchAsync(async (req, res) => {
    const { username, password } = req.body.user
    const user = await UserModels.findOne({ username })
    const validPassword = await bcrypt.compare(password, user.password)
    if (validPassword) {
        req.session.user_id = user._id
        req.session.user_role = user.role
        req.session.user_fname = user.fullname
        res.redirect(`/account/${user._id}`)
    } else {
        throw new ExpressError('Username atau password salah', 999)
    }
}))
app.post('/logout', catchAsync(async (req, res) => {
    req.session.destroy()
    res.redirect("/")
}))


app.get('/secret', (req, res) => {
    if (req.session.user_role == 1) {
        res.send(req.session.user_id)
    }
    res.send('u need to login as an admin')
})
app.all('*', (req, res, next) => {
    next(new ExpressError("Halaman tidak ditemukan"), 404)
})
app.use((err, req, res, next) => {
    const { statusCode = 500 } = err
    if (!err.message) err.message = 'Oh no.. Error :('
    res.status(statusCode).render('error', { err })
})

app.listen(process.env.PORT || 3000, function () {
    console.log("Express server listening on port %d in %s mode", this.address().port, app.settings.env);
});