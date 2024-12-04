const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const dotenv = require('dotenv')

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
dotenv.config();
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// MongoDB Connection
mongoose.connect(process.env.MONGO_URL, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// Menu Item Schema
const MenuItemSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String, required: true },
  price: { type: Number, required: true },
  image: { type: String },
});

// Order Schema
const OrderSchema = new mongoose.Schema({
  items: [{ 
    menuItem: { type: mongoose.Schema.Types.ObjectId, ref: 'MenuItem' },
    quantity: Number 
  }],
  totalPrice: Number,
  status: { 
    type: String, 
    enum: ['Pending', 'Preparing', 'Ready', 'Completed'], 
    default: 'Pending' 
  },
  createdAt: { type: Date, default: Date.now }
});

const MenuItem = mongoose.model('MenuItem', MenuItemSchema);
const Order = mongoose.model('Order', OrderSchema);

// Multer configuration for image upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});
const upload = multer({ storage: storage });

// Admin Routes
app.post('/api/menu-items', upload.single('image'), async (req, res) => {
  try {
    const { name, description, price } = req.body;
    const newMenuItem = new MenuItem({
      name,
      description,
      price: parseFloat(price),
      image: req.file ? req.file.path : null
    });
    await newMenuItem.save();
    res.status(201).json(newMenuItem);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

app.get('/api/menu-items', async (req, res) => {
  try {
    const menuItems = await MenuItem.find();
    res.json(menuItems);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Order Routes
app.post('/api/orders', async (req, res) => {
  try {
    const { items } = req.body;
    
    // Calculate total price
    const orderItems = await Promise.all(items.map(async (item) => {
      const menuItem = await MenuItem.findById(item.menuItemId);
      return {
        menuItem: menuItem._id,
        quantity: item.quantity
      };
    }));

    const totalPrice = await calculateTotalPrice(orderItems);

    const newOrder = new Order({
      items: orderItems,
      totalPrice
    });

    await newOrder.save();
    res.status(201).json(newOrder);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

app.get('/api/orders', async (req, res) => {
  try {
    const orders = await Order.find().populate('items.menuItem');
    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Utility function to calculate total price
async function calculateTotalPrice(orderItems) {
  let total = 0;
  for (let item of orderItems) {
    const menuItem = await MenuItem.findById(item.menuItem);
    total += menuItem.price * item.quantity;
  }
  return total;
}

// Update Order Status
app.patch('/api/orders/:id', async (req, res) => {
  try {
    const { status } = req.body;
    const updatedOrder = await Order.findByIdAndUpdate(
      req.params.id, 
      { status }, 
      { new: true }
    );
    res.json(updatedOrder);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});