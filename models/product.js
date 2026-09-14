const mongoose = require('mongoose');
const slugify = require('slugify');

const productSchema = new mongoose.Schema({
    name: { type: String, required: true },
    slug: { type: String, unique: true },
    price: { type: Number, required: true, min: 0 },
    oldPrice: { type: Number, default: null },
    category: { 
        type: String, 
        required: true,
        enum: [
            'Raw Donor Hairs',
            'Body Wave',
            'Loose Wave',
            'Deep Wave',
            'Bob Wig',
            'Layered Wig',
            'Bone Straight',
            'Pixie Curls',
            'Fringe Wigs'
        ]
    },
    images: { type: [String], default: [] },
    stock: { type: Number, default: 10 },
    lengths: { type: [String], default: ['14', '16', '18', '20', '22', '24', '26'] },
    colors: { type: [String], default: ['Natural Black', 'Dark Brown', 'Honey Blonde', 'Burgundy', 'Platinum', 'Ombre'] },
    laceType: { type: String, default: 'HD Lace' },
    hairType: { type: String, default: '100% Human Hair' },
    weight: { type: String, default: '' },
    featured: { type: Boolean, default: false },
    active: { type: Boolean, default: true },
    rating: { type: Number, default: 0 },
    reviewCount: { type: Number, default: 0 }
}, { timestamps: true });

productSchema.pre('save', function(next) {
    if (this.isModified('name')) {
        this.slug = slugify(this.name, { lower: true, strict: true });
    }
    next();
});

module.exports = mongoose.model('Product', productSchema);