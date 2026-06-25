const axios = require('axios');

async function testSpam() {
    let successCount = 0;
    let blockCount = 0;
    
    for (let i = 1; i <= 60; i++) {
        try {
            await axios.get('http://localhost:4000/api/admin/managers', {
                validateStatus: false
            });
            successCount++;
        } catch (e) {
            console.error('Network Error', e.message);
        }
    }
    console.log(`Finished 60 requests. (Counted ${successCount} replies)`);
    
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
