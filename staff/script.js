function verifyStaff() {
    let name = document.getElementById("staffName").value.trim();
    let result = document.getElementById("result");

    if (name === "") {
        result.innerHTML = "<p style='color:#d33;'>Please type a name.</p>";
        return;
    }

    fetch("https://www.toptowertechnologies.com/id/verify.php", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({ name: name })
    })
    .then(res => res.json())
    .then(data => {
        if (!data.success) {
            result.innerHTML = `<p style='color:#d33;'>${data.message}</p>`;
        } else {
            let s = data.data;
            result.innerHTML = `
                <div class='success-box'>
                    <img src='${s.image}' alt='Staff'>
                    <h2>${s.name}</h2>
                    <p><b>Staff ID:</b> ${s.staff_id}</p>
                    <p><b>Position:</b> ${s.position}</p>
                    <p style='color:#0f0;'>✔ Verified</p>
                </div>
            `;
        }
    });
}
