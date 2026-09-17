const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  orderNumber: { type: String, unique: true },
  customerName: { type: String, required: true },
  customerEmail: { type: String, required: true },  
  customerPhone: { type: String, required: true },    
  deliveryAddress: {
    street: { type: String, required: true },
    city: { type: String, required: true },
    state: { type: String, required: true },
    instructions: String
  },
  items: [{
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    productName: String,
    price: Number,
    quantity: Number,
    selectedLength: String,
    selectedColor: String,
    image: String
  }],
  subtotal: { type: Number, required: true },
  deliveryFee: { type: Number, default: 0 },
  total: { type: Number, required: true },
  paymentMethod: { type: String, default: 'Card or Bank Transfer' },
  paymentReference: { type: String, unique: true, sparse: true },
  paymentStatus: { type: String, enum: ['Pending', 'Paid', 'Failed'], default: 'Pending' },
  orderStatus: { 
    type: String, 
    enum: ['Pending', 'Confirmed', 'Processing', 'Shipped', 'Out for Delivery', 'Delivered', 'Cancelled'], 
    default: 'Pending' 
  },
  trackingNumber: { type: String, default: null },
  trackingCarrier: { type: String, default: null },
  trackingUrl: { type: String, default: null },
  estimatedDelivery: { type: Date, default: null },
  actualDeliveryDate: { type: Date, default: null },
  statusHistory: [{
    status: { type: String },
    date: { type: Date, default: Date.now },
    note: { type: String },
    updatedBy: { type: String }
  }],
  notes: String
}, { timestamps: true });


orderSchema.pre('save', async function(next) {
  if (!this.orderNumber) {
    const Order = mongoose.model('Order');
    const lastOrder = await Order.findOne({ orderNumber: /^AE-\d+$/ })
      .sort({ createdAt: -1 })
      .select('orderNumber');

    let nextNumber = 1010;
    if (lastOrder) {
      const lastNumber = Number(lastOrder.orderNumber.slice(3));
      if (Number.isInteger(lastNumber)) nextNumber = lastNumber + 1;
    }

    this.orderNumber = `AE-${nextNumber}`;
  }
  

  if (this.orderStatus === 'Shipped' && !this.trackingNumber) {
    this.trackingNumber = 'TRK' + Date.now().toString().slice(-8) + Math.floor(Math.random() * 1000);
  }
  

  if (this.orderStatus === 'Shipped' && !this.estimatedDelivery) {
    const deliveryDate = new Date();
    deliveryDate.setDate(deliveryDate.getDate() + 5);
    this.estimatedDelivery = deliveryDate;
  }
  

  if (this.isModified('orderStatus')) {
    this.statusHistory.push({
      status: this.orderStatus,
      date: new Date(),
      note: `Order status updated to ${this.orderStatus}`
    });
  }
  
  next();
});

module.exports = mongoose.models.Order || mongoose.model('Order', orderSchema);