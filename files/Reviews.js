document.addEventListener("DOMContentLoaded", () => {
  const leaveReviewBtn = document.querySelector(".leave-review-btn");
  const reviewsGrid = document.getElementById("reviewsGrid");
  const prevBtn = document.querySelectorAll(".control-btn")[0];
  const nextBtn = document.querySelectorAll(".control-btn")[1];
  const productId = Number(
    new URLSearchParams(window.location.search).get("productId") ||
    new URLSearchParams(window.location.search).get("bundleId")
  );

  const modalHTML = `
    <div class="modal-overlay" id="reviewModal">
      <div class="modal-box">
        <div class="modal-header">
          <h3 id="reviewModalTitle">Leave a Review</h3>
          <button class="close-modal" id="closeReviewModal" type="button" aria-label="Close">&times;</button>
        </div>
        <form id="reviewForm">
          <div class="form-field-group">
            <label id="ratingLabel">Rating</label>
            <div class="star-rating-select" id="starSelect">
              <button class="star" type="button" data-value="1" aria-label="1 star">&#9733;</button>
              <button class="star" type="button" data-value="2" aria-label="2 stars">&#9733;</button>
              <button class="star" type="button" data-value="3" aria-label="3 stars">&#9733;</button>
              <button class="star" type="button" data-value="4" aria-label="4 stars">&#9733;</button>
              <button class="star" type="button" data-value="5" aria-label="5 stars">&#9733;</button>
            </div>
            <input type="hidden" id="selectedRating" value="5" />
          </div>
          <div class="form-field-group">
            <label for="reviewText">Your review</label>
            <textarea id="reviewText" name="review_text" class="custom-input-box" rows="4" maxlength="2000" placeholder="Share your experience..." required></textarea>
          </div>
          <p id="reviewFormStatus" role="status" aria-live="polite"></p>
          <button type="submit" class="submit-btn" style="border-radius: 8px; margin-top: 10px;">Submit Review</button>
        </form>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML("beforeend", modalHTML);

  const reviewModal = document.getElementById("reviewModal");
  const closeModalBtn = document.getElementById("closeReviewModal");
  const reviewForm = document.getElementById("reviewForm");
  const stars = document.querySelectorAll("#starSelect .star");
  const selectedRatingInput = document.getElementById("selectedRating");
  const reviewTextInput = document.getElementById("reviewText");
  const modalTitle = document.getElementById("reviewModalTitle");
  const formStatus = document.getElementById("reviewFormStatus");
  const submitButton = reviewForm.querySelector("[type='submit']");

  let currentPage = 0;
  const cardsPerPage = 6;
  let currentUserId = null;
  let ownReview = null;
  let productImage = "./Images/paprika.jpg";

  checkEmptyState();
  updatePagination();

  if (leaveReviewBtn) {
    leaveReviewBtn.addEventListener("click", () => openReviewModal());
  }

  closeModalBtn.addEventListener("click", () => {
    reviewModal.classList.remove("active");
  });

  reviewModal.addEventListener("click", (e) => {
    if (e.target === reviewModal) {
      reviewModal.classList.remove("active");
    }
  });

  stars.forEach((star, index) => {
    star.addEventListener("mouseover", () => highlightStars(index + 1));
    star.addEventListener("mouseout", () => highlightStars(selectedRatingInput.value));
    star.addEventListener("click", () => {
      selectedRatingInput.value = index + 1;
      highlightStars(index + 1);
    });
  });

  function highlightStars(count) {
    stars.forEach((star, idx) => {
      star.style.color = idx < count ? "#E2B02B" : "#CCC";
      star.setAttribute("aria-pressed", String(idx < count && idx === Number(count) - 1));
    });
  }
  highlightStars(5);

  reviewsGrid.addEventListener("click", event => {
    const editButton = event.target.closest(".edit-review-btn");
    if (editButton && ownReview) openReviewModal(ownReview);
  });

  reviewForm.addEventListener("submit", async event => {
    event.preventDefault();

    if (!productId) {
      formStatus.textContent = "A product could not be identified for this review.";
      return;
    }

    const rating = Number(selectedRatingInput.value);
    const reviewText = reviewTextInput.value.trim();
    if (!Number.isInteger(rating) || rating < 1 || rating > 5 || !reviewText) return;

    submitButton.disabled = true;
    formStatus.textContent = "Saving your review...";
    try {
      const editingReview = Boolean(ownReview);
      const response = await fetch(editingReview ? "/api/updateReview" : "/api/addReview", {
        method: editingReview ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingReview ? {
          review_id: ownReview.review_id ?? ownReview.reviewId,
          product_id: productId,
          rating,
          review_text: reviewText
        } : {
          productId,
          rating,
          review_text: reviewText
        })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Unable to save your review.");

      reviewModal.classList.remove("active");
      await loadPageData();
      reviewForm.reset();
      selectedRatingInput.value = "5";
      highlightStars(5);
    } catch (error) {
      formStatus.textContent = error.message;
    } finally {
      submitButton.disabled = false;
    }
  });

  async function loadPageData() {
    if (!productId) {
      setPageStatus("No product was specified.");
      leaveReviewBtn.disabled = true;
      return;
    }

    try {
      const [productResponse, reviewsResponse, accountResponse] = await Promise.all([
        fetch(`/api/fetchProducts?productId=${encodeURIComponent(productId)}`),
        fetch(`/api/fetchReviews?productId=${encodeURIComponent(productId)}`),
        fetch("/api/isLoggedIn")
      ]);

      if (!productResponse.ok) throw new Error("Unable to load product information.");
      if (!reviewsResponse.ok) throw new Error("Unable to load reviews.");

      const productData = await productResponse.json();
      const product = Array.isArray(productData) ? productData[0] : productData;
      const reviews = await reviewsResponse.json();
      if (!product) throw new Error("The requested product was not found.");

      if (accountResponse.ok) {
        const account = await accountResponse.json();
        currentUserId = Number(account.user?.userId) || null;
      } else {
        currentUserId = null;
      }

      renderProduct(product);
      renderReviews(Array.isArray(reviews) ? reviews : []);
    } catch (error) {
      console.error("Review page load failed:", error);
      setPageStatus(error.message || "Unable to load this product's reviews.");
    }
  }

  function renderProduct(product) {
    productImage = product.product_image || productImage;
    const image = document.querySelector(".product-image");
    const productName = product.product_name || "Product";
    const overview = document.querySelector(".product-details h2");
    const origin = document.querySelector(".origin-text");
    const description = document.querySelector(".description-text");

    if (image) {
      image.src = productImage;
      image.alt = productName;
    }
    if (overview) overview.textContent = productName;
    if (origin) origin.textContent = `Origin: ${product.product_country || "Unknown"}`;
    if (description) description.textContent = product.product_desc || "No description available.";
  }

  function renderReviews(reviews) {
    const ratingTotal = reviews.reduce((total, review) => total + Number(review.rating || 0), 0);
    const averageRating = reviews.length ? ratingTotal / reviews.length : 0;
    const score = document.querySelector(".score-text");
    const count = document.querySelector(".review-count");
    const ratingStars = document.querySelector(".hero-stars");

    if (score) score.textContent = `${averageRating.toFixed(1)} Out of 5 Stars`;
    if (count) count.textContent = `based on ${reviews.length} ${reviews.length === 1 ? "review" : "reviews"}`;
    if (ratingStars) {
      ratingStars.setAttribute("aria-label", `${averageRating.toFixed(1)} out of 5 stars`);
      ratingStars.querySelectorAll("i").forEach((star, index) => {
        star.classList.toggle("fa-solid", index < Math.round(averageRating));
        star.classList.toggle("fa-regular", index >= Math.round(averageRating));
      });
    }

    ownReview = currentUserId === null ? null : reviews.find(review =>
      Number(review.Customer_id ?? review.customer_id) === currentUserId
    ) || null;
    if (leaveReviewBtn) {
      leaveReviewBtn.textContent = ownReview ? "Edit Your Review" : "Leave a Review";
      leaveReviewBtn.disabled = currentUserId === null;
      leaveReviewBtn.title = currentUserId === null ? "Log in to leave a review" : "";
    }

    reviewsGrid.innerHTML = "";
    reviews.forEach(review => reviewsGrid.appendChild(createReviewCard(review)));
    currentPage = 0;
    checkEmptyState();
    updatePagination();
  }

  function createReviewCard(review) {
    const rating = Math.min(5, Math.max(0, Number(review.rating) || 0));
    const customerId = review.Customer_id ?? review.customer_id;
    const reviewId = review.review_id ?? review.reviewId;
    const card = document.createElement("article");
    card.className = "review-card";
    card.innerHTML = `
      <img src="${escapeHTML(productImage)}" alt="${escapeHTML(document.querySelector(".product-image")?.alt || "Product")}" class="review-card-img" />
      <div class="review-card-body">
        <p class="reviewer-name">Customer #${escapeHTML(String(customerId ?? ""))}</p>
        <div class="review-rating">
          Rating: <span class="stars">${"★".repeat(rating)}${"☆".repeat(5 - rating)}</span>
          <span class="rating-num">[${rating} ${rating === 1 ? "star" : "stars"}]</span>
        </div>
        <p class="review-comment">${escapeHTML(String(review.review_text || ""))}</p>
        ${currentUserId !== null && Number(customerId) === currentUserId && reviewId
          ? '<button class="edit-review-btn" type="button">Edit</button>'
          : ""}
      </div>
    `;
    return card;
  }

  function openReviewModal(review = null) {
    if (currentUserId === null) {
      window.location.href = "/login";
      return;
    }
    modalTitle.textContent = review ? "Edit Your Review" : "Leave a Review";
    submitButton.textContent = review ? "Save Changes" : "Submit Review";
    reviewTextInput.value = review?.review_text || "";
    selectedRatingInput.value = String(Number(review?.rating) || 5);
    formStatus.textContent = "";
    highlightStars(selectedRatingInput.value);
    reviewModal.classList.add("active");
    reviewTextInput.focus();
  }

  function setPageStatus(message) {
    reviewsGrid.innerHTML = `<p class="review-page-status" role="status">${escapeHTML(message)}</p>`;
  }

  function updatePagination() {
    const cards = document.querySelectorAll(".review-card");
    if (cards.length === 0) {
      if (prevBtn) prevBtn.style.opacity = "0.5";
      if (nextBtn) nextBtn.style.opacity = "0.5";
      return;
    }

    const totalPages = Math.ceil(cards.length / cardsPerPage);

    cards.forEach((card, index) => {
      const start = currentPage * cardsPerPage;
      const end = start + cardsPerPage;
      card.style.display = (index >= start && index < end) ? "flex" : "none";
    });

    if (prevBtn) prevBtn.style.opacity = currentPage === 0 ? "0.5" : "1";
    if (nextBtn) nextBtn.style.opacity = currentPage >= totalPages - 1 ? "0.5" : "1";
  }

  if (prevBtn) prevBtn.addEventListener("click", () => {
    if (currentPage > 0) {
      currentPage--;
      updatePagination();
    }
  });

  if (nextBtn) nextBtn.addEventListener("click", () => {
    const cards = document.querySelectorAll(".review-card");
    if ((currentPage + 1) * cardsPerPage < cards.length) {
      currentPage++;
      updatePagination();
    }
  });

  function checkEmptyState() {
    const cards = document.querySelectorAll(".review-card");
    if (cards.length === 0) {
      reviewsGrid.innerHTML = `
        <div id="noReviewsMsg" style="grid-column: 1 / -1; text-align: center; padding: 40px; color: #888; font-family: InstrumentSans, sans-serif;">
          No reviews yet. Be the first to leave a review!
        </div>
      `;
    }
  }

  function escapeHTML(str) {
    return String(str).replace(/[&<>'"]/g,
      tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
    );
  }

  loadPageData();
});