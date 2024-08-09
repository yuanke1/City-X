const Spot = require('../models/spot');
const maptilerClient = require("@maptiler/client");
maptilerClient.config.apiKey = process.env.MAPTILER_API_KEY;
const { cloudinary } = require('../cloudinary');

module.exports.index = async (req, res) => {
    const spots = await Spot.find({});
    res.render('spots/index', {spots});
}

module.exports.renderNewForm = (req, res) => {
    res.render('spots/new');
}

module.exports.createSpot = async (req, res) => {
    const geoData = await maptilerClient.geocoding.forward(req.body.spot.location, { limit: 1 });
    const spot = new Spot(req.body.spot);
    spot.geometry = geoData.features[0].geometry;
    spot.images = req.files.map(f => ({ url: f.path, filename: f.filename }));
    spot.author = req.user._id;
    await spot.save();
    req.flash('success', 'Successfully made a new spot');
    res.redirect(`/spots/${spot._id}`);
}

module.exports.showSpot = async (req, res) => {
    const spot = await Spot.findById(req.params.id).populate({
        path: 'reviews',
        populate: {
            path: 'author'
        }
    }).populate('author');
    if (!spot) {
        req.flash('error', 'Can not find that spot')
        res.redirect('/spots');
    }
    res.render('spots/show', { spot });
}

module.exports.renderEditForm = async (req, res) => {
    const spot = await Spot.findById(req.params.id);
    res.render('spots/edit', { spot });
}

module.exports.updateSpot = async (req, res) => {
    const spot = await Spot.findByIdAndUpdate(req.params.id, req.body.spot);
    const geoData = await maptilerClient.geocoding.forward(req.body.spot.location, { limit: 1 });
    spot.geometry = geoData.features[0].geometry;
    const img = req.files.map(f => ({ url: f.path, filename: f.filename }));
    spot.images.push(...img);
    await spot.save()
    if (req.body.deleteImages) {
        for (let filename of req.body.deleteImages){
            await cloudinary.uploader.destroy(filename);
        }
        await spot.updateOne({ $pull: {images: {filename: {$in: req.body.deleteImages}}} });
    }
    req.flash('success', 'Sucessfully updated spot')
    res.redirect(`/spots/${spot._id}`);
}

module.exports.deleteSpot = async (req, res) => {
    await Spot.findByIdAndDelete(req.params.id);
    req.flash('success', 'Sucessfully deleted spot')
    res.redirect('/spots');
}

module.exports.searchSpot = async (req, res) => {
    const { searchWord } = req.body;
    const spots = await Spot.find({title: { $regex: searchWord}})
    if (spots.length >= 1){
        req.flash('success', `Successfully Find ${spots.length} result(s) containing the key word "${searchWord}"`);
    } else {
        req.flash('error', `Can not find any locations containing the key word ${searchWord}`);
    }
    res.render('spots/index', { spots, message: req.flash('success') });
}