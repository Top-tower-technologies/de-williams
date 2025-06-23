// === JavaScript: Integrate API with existing frontend ===

// Elements
const checkInInput = document.getElementById("checkInDate");
const checkOutInput = document.getElementById("checkOutDate");
const adultSelect = document.getElementById("adults");
const childrenSelect = document.getElementById("children");
const currencySelect = document.getElementById("currency");
const roomListContainer = document.getElementById("room-list");
const bookButtons = document.querySelectorAll(".book-button");
const goToFormBtn = document.getElementById("go-to-form");
const bookingSummaryPage = document.getElementById("booking-summary");
const bookingFormPage = document.getElementById("booking-form");

// Track selected room info
let selectedRoomId = null;
let selectedRoomSummary = null;

function navigateTo(pageId) {
  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  document.getElementById(pageId).classList.add("active");
}

async function fetchRoomList() {
  const check_in = checkInInput.value;
  const check_out = checkOutInput.value;
  const adult = parseInt(adultSelect.value);
  const children = parseInt(childrenSelect.value);

  const response = await fetch("https://hms-api-okfi.onrender.com/guest/find-stay/room_service", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      check_in,
      check_out,
      guests: {
        adult,
        children,
        infant: 0
      }
    })
  });

  const data = await response.json();
  if (data.success) {
    renderRooms(data.data);
  }
}

function renderRooms(rooms) {
  const roomListPage = document.getElementById("room-list");
  roomListPage.innerHTML = ""; // Clear previous

  rooms.forEach(room => {
    const card = document.createElement("div");
    card.className = "cardo";
    card.innerHTML = `
      <div class="top-section">
        <div class="left-section">
          <div class="room-details">
            <h2>${room.category.name}</h2>
            <div class="price-per-night">From $${room.category.price.base_price} / Night</div>
            <div class="room-description">
              ${room.category.description.split(".")[0]}.
            </div>
            <div class="icons">
              <div>🛁 ${room.no_of_bathrooms} Bathroom</div>
              <div>🛏️ ${room.bed_type}</div>
              <div>🧍‍♂️ Sleeps ${room.max_guest_no}</div>
            </div>
          </div>
          <div class="room-image">
            <img src="/de-williams/images/image 6.png" alt="Room Image">
          </div>
        </div>
        <div class="right-section">
          <h3>Booking Details</h3>
          <p>📅 ${checkInInput.value} – ${checkOutInput.value}</p>
          <p>👥 ${adultSelect.value} Adults, ${childrenSelect.value} Children</p>
        </div>
      </div>
      <div class="bottom-section">
        <div class="price-info">
          USD ${room.category.price.base_price} <span>Cost for 1 night, ${room.guest_no} guests</span>
        </div>
        <div class="action-group">
          <div class="pay-later">✔️ Book now, Pay later</div>
          <button class="book-button" data-room-id="${room.id}">Book Now</button>
        </div>
      </div>
    `;
    roomListPage.appendChild(card);
  });

  // Attach event listeners
  document.querySelectorAll(".book-button").forEach(button => {
    button.addEventListener("click", async (e) => {
      selectedRoomId = e.target.getAttribute("data-room-id");
      await fetchBookingSummary(selectedRoomId);
      navigateTo("booking-summary");
    });
  });
}

async function fetchBookingSummary(roomId) {
  const check_in = checkInInput.value;
  const check_out = checkOutInput.value;
  const adult = adultSelect.value;
  const currency = currencySelect.value;

  const url = `https://hms-api-okfi.onrender.com/guest/find-stay/room_service/${roomId}/summary?check_in=${check_in}&check_out=${check_out}&adult=${adult}&currency=${currency}`;
  const res = await fetch(url);
  const data = await res.json();

  if (data.success) {
    selectedRoomSummary = data.data;
    updateBookingSummaryUI(data.data);
  }
}

function updateBookingSummaryUI(summary) {
  const summaryBox = bookingSummaryPage.querySelector(".booking-summary");
  summaryBox.innerHTML = `
    <h2>Booking Summary</h2>
    <div class="booking-item">
      <span>${summary.pricing.nights} Nights</span>
      <span>${summary.pricing.currency} ${summary.pricing.subtotal}</span>
    </div>
    <div class="booking-item">
      <span>V.A.T</span>
      <span>${summary.pricing.currency} ${summary.pricing.tax}</span>
    </div>
    <div class="booking-item">
      <span>Discount</span>
      <span>${summary.pricing.currency} ${summary.pricing.discount}</span>
    </div>
    <div class="subtotal">
      Subtotal: ${summary.pricing.currency} ${summary.pricing.total}
    </div>
  `;
}

goToFormBtn.addEventListener("click", () => {
  navigateTo("booking-form");
});

const bookingForm = document.querySelector(".booking-form");
bookingForm.addEventListener("submit", async function(e) {
  e.preventDefault();

  const formData = new FormData(bookingForm);
  const payload = {
    check_in: checkInInput.value,
    check_out: checkOutInput.value,
    first_name: formData.get("first_name") || "Anonymous",
    last_name: formData.get("last_name") || "Mous",
    email: formData.get("email") || "anonym@mous.com",
    phone: "1234567890",
    guests: {
      adult: parseInt(adultSelect.value),
      children: parseInt(childrenSelect.value),
      infant: 0
    },
    special_request: formData.get("special_request") || "Checking for the best"
  };

  const res = await fetch(`https://hms-api-okfi.onrender.com/guest/find-stay/room_service/${selectedRoomId}/book/anonymous?pay_now=false`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-hotel-domain": "gpsignature.com"
    },
    body: JSON.stringify(payload)
  });

  const result = await res.json();
  if (result.success) {
    alert(`Booking Successful!\nRef: ${result.data.transaction_ref}\nTotal: ${result.data.currency} ${result.data.total}`);
  } else {
    alert("Booking failed. Please try again.");
  }
});

// Optional: Auto fetch room list on load
// window.addEventListener('DOMContentLoaded', fetchRoomList);
