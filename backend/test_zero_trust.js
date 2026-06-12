const axios = require('axios');

async function testSpam() {
    let successCount = 0;
    let blockCount = 0;
    
    // Attempt 60 requests in a loop (Threshold is 50)
    for (let i = 1; i <= 60; i++) {
        try {
            // Need a valid session or at least hit the endpoint
            // Wait, zero trust filter is before authentication! 
            // So we can hit it and it will block us based on IP before auth fails.
            await axios.get('http://localhost:4000/api/admin/managers', {
                validateStatus: false // don't throw on 4xx/5xx
            });
            successCount++;
        } catch (e) {
            console.error('Network Error', e.message);
        }
    }
    console.log(`Finished 60 requests. (Counted ${successCount} replies)`);
    
    // Now make one more request and log the status code
    try {
        const res = await axios.get('http://localhost:4000/api/admin/managers', {
            validateStatus: false
        });
        console.log(`Status of 61st request: ${res.status} - ${JSON.stringify(res.data)}`);
    } catch (e) {
        console.error(e.message);
    }
}

testSpam();
