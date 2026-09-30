const express = require("express");
const app = express.Router();
const { checkAuth } = require("../../imports/token");
const db = require("../../imports/database");

app.customPath = "/api";

app.get("/fetchReviews", async (req, res) => {
  const productId = Number(req.query.productId);
  try {
    const result = await db.execute({
      sql: `

    SELECT *
    FROM review
    WHERE product_id = ?
                `,
      args: [productId],
    });

    return res.status(200).json(result.rows);
  } catch (error) {
    console.error("Failed to fetch reviews:", error);

    return res.status(500).json({
      error: "Failed to fetch reviews",
    });
  }
});

/*
 * ADD A PRODUCT OR BUNDLE TO THE LOGGED-IN CUSTOMER'S WISHLIST
 */
app.post("/addReview", checkAuth("user"), async (req, res) => {
  try {
    const customerId = Number(req.user.userId);
    const productId = Number(req.body.productId);
    const rating = Number(req.body.rating);
    const reviewText = req.body.review_text;

    if (!customerId) {
      return res.status(401).json({
        error: "Customer is not logged in",
      });
    }

    if (!productId) {
      return res.status(400).json({
        error: "A valid productId is required",
      });
    }

    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return res.status(400).json({
        error: "Rating must be an integer between 1 and 5",
      });
    }

    if (!reviewText || typeof reviewText !== "string") {
      return res.status(400).json({
        error: "Review text is required",
      });
    }

    const result = await db.execute({
      sql: `
        INSERT INTO review (
          product_id,
          Customer_id,
          rating,
          review_text
        )
        VALUES (?, ?, ?, ?)
      `,
      args: [productId, customerId, rating, reviewText],
    });

    return res.status(201).json({
      message: "Review added successfully",
      reviewId: Number(result.lastInsertRowid),
    });
  } catch (error) {
    console.error("Failed to put review:", error);

    return res.status(500).json({
      error: "Failed to put review",
    });
  }
});

app.put("/updateReview", checkAuth("user"), async (req, res) => {
  try {
    const customerId = Number(req.user.userId);
    const reviewId = Number(req.body.review_id);
    const productId = Number(req.body.product_id);
    const rating = Number(req.body.rating);
    const reviewText = req.body.review_text;

    if (!customerId) {
      return res.status(401).json({
        error: "Customer is not logged in",
      });
    }

    if (!Number.isInteger(reviewId) || reviewId <= 0) {
      return res.status(400).json({
        error: "A valid review_id is required",
      });
    }

    if (!Number.isInteger(productId) || productId <= 0) {
      return res.status(400).json({
        error: "A valid product_id is required",
      });
    }

    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return res.status(400).json({
        error: "Rating must be an integer between 1 and 5",
      });
    }

    if (typeof reviewText !== "string" || !reviewText.trim()) {
      return res.status(400).json({
        error: "Review text is required",
      });
    }

    const result = await db.execute({
      sql: `
        UPDATE review
        SET product_id = ?,
            rating = ?,
            review_text = ?
        WHERE review_id = ?
          AND Customer_id = ?
      `,
      args: [productId, rating, reviewText.trim(), reviewId, customerId],
    });

    if (result.rowsAffected === 0) {
      return res.status(404).json({
        error: "Review not found or you do not own this review",
      });
    }

    return res.status(200).json({
      message: "Review updated successfully",
      review_id: reviewId,
    });
  } catch (error) {
    console.error("Failed to update review:", error);

    return res.status(500).json({
      error: "Failed to update review",
    });
  }
});

app.delete("/deleteReview", checkAuth("user"), async (req, res) => {
  try {
    const customerId = Number(req.user.userId);
    const reviewId = Number(req.body.reviewId);

    if (!customerId) {
      return res.status(401).json({
        error: "Customer is not logged in",
      });
    }

    if (!reviewId) {
      return res.status(400).json({
        error: "A valid reviewId is required",
      });
    }

    const result = await db.execute({
      sql: `
        DELETE FROM review
        WHERE review_id = ?
          AND Customer_id = ?
      `,
      args: [reviewId, customerId],
    });

    if (result.rowsAffected === 0) {
      return res.status(404).json({
        error: "Review not found or you do not own this review",
      });
    }

    return res.json({
      message: "Review deleted successfully",
    });
  } catch (error) {
    console.error("Failed to delete review:", error);

    return res.status(500).json({
      error: "Failed to delete review",
    });
  }
});

module.exports = app;
