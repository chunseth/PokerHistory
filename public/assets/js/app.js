document.addEventListener('DOMContentLoaded', () => {
    const handForm = document.getElementById('handForm');
    const handsList = document.getElementById('handsList');
    const currentTimeElement = document.getElementById('currentTime');
    const currentDateElement = document.getElementById('currentDate');
    const dateInput = document.getElementById('date');

    // Function to update the current time and date
    function updateDateTime() {
        const now = new Date();
        
        // Update time
        const timeString = now.toLocaleTimeString('en-US', {
            hour12: false,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
        currentTimeElement.textContent = timeString;
        
        // Update date
        const dateString = now.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        currentDateElement.textContent = dateString;
    }

    // Update time every second
    updateDateTime();
    setInterval(updateDateTime, 1000);

    // Set today's date as default
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    dateInput.value = `${year}-${month}-${day}`;
    
    handForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const formData = {
            date: document.getElementById('date').value,
            buyIn: parseFloat(document.getElementById('buyIn').value),
            cashOut: parseFloat(document.getElementById('cashOut').value)
        };

        try {
            const response = await fetch('/api/hands', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
            });

            if (response.ok) {
                // Clear the form
                handForm.reset();
                // Reset the date to today
                dateInput.value = `${year}-${month}-${day}`;
                // Refresh the hands list
                loadHands();
            } else {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to add hand');
            }
        } catch (error) {
            console.error('Error:', error);
            alert(error.message || 'Failed to add hand. Please try again.');
        }
    });

    // Function to load and display hands
    async function loadHands() {
        try {
            const response = await fetch('/api/hands');
            const hands = await response.json();
            
            if (hands.length === 0) {
                handsList.innerHTML = '<div class="text-center text-gray-500">No hands recorded yet</div>';
                return;
            }

            handsList.innerHTML = hands.map(hand => `
                <div class="border rounded-lg p-4">
                    <div class="flex justify-between items-center">
                        <span class="font-medium">${new Date(hand.date).toLocaleDateString('en-US', {
                            weekday: 'short',
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric'
                        })}</span>
                        <span class="text-${hand.cashOut >= hand.buyIn ? 'green' : 'red'}-600 font-bold">
                            $${(hand.cashOut - hand.buyIn).toFixed(2)}
                        </span>
                    </div>
                    <div class="text-sm text-gray-500 mt-1">
                        Buy-in: $${hand.buyIn.toFixed(2)} | Cash-out: $${hand.cashOut.toFixed(2)}
                    </div>
                </div>
            `).join('');
        } catch (error) {
            console.error('Error loading hands:', error);
            handsList.innerHTML = '<div class="text-center text-red-500">Error loading hands</div>';
        }
    }

    // Load hands when the page loads
    loadHands();
}); 