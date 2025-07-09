const express = require("express");
const router = express.Router();
const User = require("../models/User");
const Blog = require("../models/Blog");
const verifyAdmin = require("../middlewares/verifyAdmin");
const verifyUser = require("../middlewares/verifyUser");

/**
 * ✅ Register user after Firebase login
 * Public route: Adds user to MongoDB if not already there
 */
router.post("/register", verifyUser, async (req, res) => {
  try {
    const { name, photoUrl } = req.body;
    const email = req.firebaseUser?.email;

    if (!email) {
      return res.status(400).json({ message: "📧 البريد الإلكتروني مطلوب" });
    }

    let user = await User.findOne({ email });

    if (!user) {
      // 🆕 Create new user
      user = new User({
        email,
        name,
        role: "user",
        blocked: false,
        photoUrl: photoUrl || "",
        createdAt: new Date(),
      });
      await user.save();
    } else {
      // 🔁 Update existing user (photo or name if changed)
      let updated = false;

      if (
        photoUrl && // only do anything if we actually got a photo
        (!user.photoUrl || user.photoUrl !== photoUrl) // AND it's different from what's in DB
      ) {
        user.photoUrl = photoUrl;
        updated = true;
      }

      if (name && user.name !== name) {
        user.name = name;
        updated = true;
      }

      if (updated) {
        await user.save();
      }
    }

    res.status(200).json(user);
  } catch (err) {
    console.error("❌ Registration error:", err);
    res.status(500).json({ message: "فشل تسجيل المستخدم" });
  }
});

/**
 * 🔍 Check if user is blocked (by email)
 */
router.post("/check-blocked", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: "Email is required" });

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "User not found" });

    res.status(200).json({ blocked: user.blocked });
  } catch (err) {
    console.error("❌ Block check error:", err);
    res.status(500).json({ message: "فشل التحقق من حالة الحظر" });
  }
});

/**
 * 🔐 Get all users (Admin only)
 */
router.get("/", verifyAdmin, async (req, res) => {
  try {
    const users = await User.find().sort({ createdAt: -1 });
    res.status(200).json(users);
  } catch (err) {
    console.error("❌ Failed to fetch users:", err);
    res.status(500).json({ message: "خطأ في تحميل المستخدمين" });
  }
});

router.get("/status/:email", async (req, res) => {
  const user = await User.findOne({ email: req.params.email });
  if (!user) return res.status(404).json({ blocked: false });
  res.json({ blocked: user.blocked });
});

/**
 * 🔍 Get current user (based on Firebase token)
 */
router.get("/me", verifyUser, async (req, res) => {
  try {
    const user = await User.findOne({ email: req.user.email });
    if (!user) {
      return res.status(404).json({ message: "❌ المستخدم غير موجود" });
    }
    res.status(200).json(user);
  } catch (err) {
    console.error("❌ Error fetching user:", err);
    res.status(500).json({ message: "فشل في جلب بيانات المستخدم" });
  }
});

/**
 * 📧 Get user by email (public-ish)
 */
router.get("/:email", async (req, res) => {
  try {
    const user = await User.findOne({ email: req.params.email });
    if (!user) return res.status(404).json({ error: "User not found" });

    res.json(user);
  } catch (err) {
    console.error("❌ Error fetching user by email:", err);
    res.status(500).json({ error: "Failed to fetch user" });
  }
});

/**
 * ⛔ Block / Unblock user (Admin only)
 */
router.put("/block/:id", verifyAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user)
      return res.status(404).json({ message: "❗ المستخدم غير موجود" });

    user.blocked = !user.blocked;
    await user.save();

    res.status(200).json({ success: true, blocked: user.blocked });
  } catch (err) {
    console.error("❌ Error blocking/unblocking user:", err);
    res.status(500).json({ message: "فشل في تحديث حالة المستخدم" });
  }
});

/**
 * 📚 Get all blogs (Admin only)
 */
router.get("/blogs", verifyUser, verifyAdmin, async (req, res) => {
  try {
    const blogs = await Blog.find().populate("author", "email name");
    res.status(200).json(blogs);
  } catch (err) {
    console.error("❌ Error fetching blogs:", err);
    res.status(500).json({ message: "خطأ في تحميل المقالات" });
  }
});

/**
 * ✅ Verify a blog (Admin only)
 */
// ✅ Toggle Blog Verification (Admin Only)
router.put("/verify/:id", verifyAdmin, async (req, res) => {
  try {
    const blog = await Blog.findById(req.params.id);
    if (!blog)
      return res.status(404).json({ message: "❌ المقالة غير موجودة" });

    blog.verified = !blog.verified;
    await blog.save();

    res.status(200).json({ success: true, verified: blog.verified });
  } catch (err) {
    console.error("❌ Error verifying blog:", err);
    res.status(500).json({ message: "فشل التحقق من المقالة" });
  }
});

/**
 * 🗑️ Delete a blog (Admin only)
 */
router.delete("/blogs/:id", verifyAdmin, async (req, res) => {
  try {
    const blog = await Blog.findByIdAndDelete(req.params.id);
    if (!blog) {
      return res.status(404).json({ message: "❗ المقالة غير موجودة" });
    }

    res.status(200).json({ success: true });
  } catch (err) {
    console.error("❌ Error deleting blog:", err);
    res.status(500).json({ message: "خطأ في حذف المقالة" });
  }
});

module.exports = router;
