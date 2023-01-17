
export {HttpRequests}

const base_path = "http://localhost:8080/"

class HttpRequests {
    static async listNodeIds() {
        const res = await fetch(base_path + "get-all-node-ids", {method: "GET"})
        return res.json()
    }

    static async addNode() {
        const params = {}
        const urlParams = new URLSearchParams(params).toString()
        const fullUrl = base_path + "add?" + urlParams
        const res = await fetch(fullUrl, {method: "POST"})
        return res.json()
    }
}
