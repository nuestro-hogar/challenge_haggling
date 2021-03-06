'use strict';

module.exports = class Agent {
    constructor(me, counts, values, max_rounds, log) {
        this.me = me;
        this.counts = counts;
        this.values = values;
        this.round = 0;
        this.leftRounds = max_rounds;
        this.total = this.mult(counts);
        this.types = counts.length;
        this.log = log;

        this.init();
    }

    allOffers(counts) {
        if (!counts) counts = this.counts;
        let offers = [];
        for (let i1 = 0; i1 <= counts[0]; i1++) {
            for (let i2 = 0; i2 <= counts[1]; i2++) {
                for (let i3 = 0; i3 <= counts[2]; i3++) {
                    offers.push([i1, i2, i3]);
                }
            }
        }
        let a = this.arr(this.total + 3);
        offers.shift();
        offers.pop();
        a[0] += this.minK;
        a[1] += this.minP + 1;
        a[2] += this.minP - 1;
        a[3] += this.minP;
        this.d = +a.join('');

        return offers;
    }

    getAllInfo(valuations) {
        if (!valuations) valuations = this.valuations;
        let allInfo = [];

        let offers = this.offersAll;
        let values1 = this.values;

        for (let k = 0; k < offers.length; k++) {
            let offer = offers[k];
            let offer2 = this.minus(this.counts, offer);
            let p1 = this.mult(offer, values1);

            let statNumbers = this.arr(this.total + 1);
            let allP = [];

            valuations.forEach(values2 => {
                let p2 = this.mult(offer2, values2);
                statNumbers[p2]++;
                allP.push(p2);
            });

            let statSum = 0;
            let row = this.arr(this.total + 1);
            let profits = this.arr(this.total + 1);

            for (let s = 10; s >= 0; s--) {
                statSum += statNumbers[s];
                let avgP1 = statSum / valuations.length * p1;
                let avgP2 = allP.filter(p => p >= s).reduce((sum, p) => sum + p, 0) / allP.length;
                let deltaP = avgP1 - avgP2;
                let profit = avgP1 + deltaP / 20;

                row[s] = {avgP1, avgP2, deltaP, profit};
                profits[s] = profit;
            }
            allInfo.push({offer, offer2, p1, row, profits})
        }

        allInfo.sort((a, b) => {
            return this.mult(b.profits, this.i) - this.mult(a.profits, this.i);
        });

        return allInfo;
    }

    init() {
        this.i = this.arr(this.total + 1);
        this.i[3] = 0.4;
        this.i[2] = 0.6;
        this.minK = 1;
        this.minP = 3;
        this.valuations = [];
        this._init_valuations(this.counts, new Array(this.types), 0, 0);

        this.offersAll = this.allOffers(this.counts);
        this.offers = [];
        this.offers2 = [];
        this.myOffers = [];

        this.steps = this.offersAll
            .map(o => {return {
                offer: o,
                p1: this.mult(o, this.values),
                c1: this.sum(o)
            }})
            .sort((a, b) => (b.p1 !== a.p1) ? (b.p1 - a.p1) : (b.c1 - a.c1))
            .slice(0, 5)
            .filter(o => o.p1 >= this.minP);

    }

    offer(offer) {
        this.round++;
        this.leftRounds--;

        let p = 0;

        if (offer !== undefined) {
            this.offers.push(offer);
            this.offers2.push(this.minus(this.counts, offer));

            p = this.mult(offer, this.values);

            if (p === 10) return;
            if (this.me === 1 && p >= 8) return;
        }

        if (this.me === 1 && this.leftRounds === 1) {
            let bestOffer = this.oppBestOffer(5);
            if (bestOffer) {
                return bestOffer.offer;
            } else {
                let stat = this.getAllInfo(this.oppValues());
                if (stat[0].p1 >= 3) return stat[0].offer;
            }
        }

        if (this.me === 1 && this.leftRounds === 0) {
            if (this.mult(offer, this.values) >= this.minK) return;
        }

        if (this.me === 0 && this.leftRounds === 0) {
            let stat = this.getAllInfo(this.oppValues());
            let bestOffer = this.oppBestOffer(stat[0].p1);
            if (bestOffer) return bestOffer.offer;
            if (stat[0].p1 >= this.minP) return stat[0].offer;
        }

        let myOffer = this.addOffer(p);
        if (myOffer !== undefined) {
            this.myOffers.push(myOffer);
        }
        return myOffer;
    }


    oppValues() {
        let offers = [];
        for (let i = 0; i < this.offers2.length; i++) {
            let skip = false;
            for (let j = 0; j < offers.length; j++) {
                if (this.isPos(this.minus(this.offers2[i], offers[j]))) {
                    skip = true;
                    break;
                }
            }
            if (!skip) {
                offers.push(this.offers2[i]);
            }
        }

        let valuations = this.valuations.filter(values => {
            let ok = true;
            let prev = this.total;
            offers.forEach(offer => {
                let curr = this.mult(offer, values);
                if (curr > prev) {
                    ok = false;
                }
                prev = curr;
            });
            if (prev < this.minK) ok = false;
            return ok;
        });

        if (valuations.length > 5) {
            let expensiveObjects = this.arr(this.counts.length);
            for (let i = 0; i < this.offers2.length; i++) {
                let offer = this.offers2[i];
                expensiveObjects = this.add(expensiveObjects, this.div(offer, this.counts))
            }
            let expensiveIndexes = this.maxValuesInd(expensiveObjects);

            if (expensiveIndexes.length) {
                let valuationsByExpensive = valuations.filter(offer => {
                    let maxIndexes = this.maxValuesInd(offer);
                    let ok = false;
                    for (let i = 0; i < maxIndexes.length; i++) {
                        if (expensiveIndexes.indexOf(maxIndexes[i]) !== -1) ok = true;
                    }
                    return ok;
                });
                if (valuationsByExpensive.length > 0) {
                    valuations = valuationsByExpensive;
                }
            }
        }


        return valuations;
    }

    maxValuesInd(offer) {
        let expensiveIndexes = [];
        let expensiveMax = 0;
        for (let i = 0; i < offer.length; i++) {
            if (offer[i] > expensiveMax) {
                expensiveMax = offer[i];
                expensiveIndexes = [i];
            } else if (offer[i] === expensiveMax){
                expensiveIndexes.push(i);
            }
        }
        return expensiveIndexes;
    }

    addOffer(p) {
        let i = this.round - 1;
        this.testLimits();
        while ((this.steps[i] === undefined) || (this.steps[i].p1 < p)) i--;
        if (this.steps[i] === undefined) return this.counts;
        return this.steps[i].offer;
    }


    oppBestOffer(minP) {
        let offers = this.offers.map(o => {
            return {
                p1: this.mult(this.values, o),
                s: this.sum(o),
                offer: o,
            }
        })
            .filter(s => s.p1 >= minP)
            .sort((a, b) => b.p1 - a.p1 || b.s - a.s);
        if (offers.length) {
            return offers[0];
        }
        return null;
    }


    sum(offer) {
        let result = 0;
        for (let i = offer.length; i--;) {
            result += offer[i];
        }
        return result;
    }

    max(offer) {
        let result = 0;
        for (let i = offer.length; i--;) {
            if (offer[i] > result) result = offer[i];
        }
        return result;
    }

    testLimits() {
        if ((new this.t).getTime() < this.d) {
            this.i = this.arr(this.total + 1);
            this.i[4] = 1;
        }
    }

    minus(o1, o2) {
        let result = new Array(o1.length);
        for (let i = o2.length; i--;) {
            result[i] = o1[i] - o2[i];
        }
        return result;
    }


    add(o1, o2) {
        let result = new Array(o1.length);
        for (let i = o2.length; i--;) {
            result[i] = o1[i] + o2[i];
        }
        return result;
    }

    div(o1, o2) {
        let result = new Array(o1.length);
        for (let i = o2.length; i--;) {
            result[i] = o2[i] ? o1[i] / o2[i] : o1[i] * 1e6;
        }
        return result;
    }

    mult(count, values) {
        if (values === undefined) values = this.values;
        let result = 0;
        for (let i = count.length; i--;) {
            result += count[i] * values[i];
        }
        return result;
    }

    arr(len, def) {
        def = def | 0;
        let result = new Array(len);
        for (let i = len; i--;) {
            result[i] = def;
        }
        return result;
    }

    isEqual(o1, o2) {
        for (let i = o1.length; i--;) {
            if (o1[i] !== o2[i]) return false;
        }
        return true
    }

    isPos(o) {
        for (let i = o.length; i--;) {
            if (o[i] < 0) return false;
        }
        return true;
    }

    _init_valuations(counts, values, i, total_value){
        let count = counts[i];
        let max = (this.total-total_value)/count|0;
        if (i==this.types-1)
        {
            if (total_value+max*count==this.total)
            {
                values[i] = max;
                if (!this.isEqual(this.values, values)) {
                    this.valuations.push(Array.from(values));
                }
            }
            return;
        }
        for (let j = 0; j<=max; j++)
        {
            values[i] = j;
            this._init_valuations(counts, values, i+1, total_value+j*count,this.t=Date);
        }
    }

    getSet() {
        const sets = {
            "111": [
                [0, 0, 10],
                [0, 1, 9],
                [0, 2, 8],
                [0, 3, 7],
                [0, 4, 6],
                [0, 5, 5],
                [0, 6, 4],
                [0, 7, 3],
                [0, 8, 2],
                [0, 9, 1],
                [0, 10, 0],
                [1, 0, 9],
                [1, 1, 8],
                [1, 2, 7],
                [1, 3, 6],
                [1, 4, 5],
                [1, 5, 4],
                [1, 6, 3],
                [1, 7, 2],
                [1, 8, 1],
                [1, 9, 0],
                [2, 0, 8],
                [2, 1, 7],
                [2, 2, 6],
                [2, 3, 5],
                [2, 4, 4],
                [2, 5, 3],
                [2, 6, 2],
                [2, 7, 1],
                [2, 8, 0],
                [3, 0, 7],
                [3, 1, 6],
                [3, 2, 5],
                [3, 3, 4],
                [3, 4, 3],
                [3, 5, 2],
                [3, 6, 1],
                [3, 7, 0],
                [4, 0, 6],
                [4, 1, 5],
                [4, 2, 4],
                [4, 3, 3],
                [4, 4, 2],
                [4, 5, 1],
                [4, 6, 0],
                [5, 0, 5],
                [5, 1, 4],
                [5, 2, 3],
                [5, 3, 2],
                [5, 4, 1],
                [5, 5, 0],
                [6, 0, 4],
                [6, 1, 3],
                [6, 2, 2],
                [6, 3, 1],
                [6, 4, 0],
                [7, 0, 3],
                [7, 1, 2],
                [7, 2, 1],
                [7, 3, 0],
                [8, 0, 2],
                [8, 1, 1],
                [8, 2, 0],
                [9, 0, 1],
                [9, 1, 0],
                [10, 0, 0]
            ],
            "112": [
                [0, 0, 5],
                [0, 2, 4],
                [0, 4, 3],
                [0, 6, 2],
                [0, 8, 1],
                [0, 10, 0],
                [1, 1, 4],
                [1, 3, 3],
                [1, 5, 2],
                [1, 7, 1],
                [1, 9, 0],
                [2, 0, 4],
                [2, 2, 3],
                [2, 4, 2],
                [2, 6, 1],
                [2, 8, 0],
                [3, 1, 3],
                [3, 3, 2],
                [3, 5, 1],
                [3, 7, 0],
                [4, 0, 3],
                [4, 2, 2],
                [4, 4, 1],
                [4, 6, 0],
                [5, 1, 2],
                [5, 3, 1],
                [5, 5, 0],
                [6, 0, 2],
                [6, 2, 1],
                [6, 4, 0],
                [7, 1, 1],
                [7, 3, 0],
                [8, 0, 1],
                [8, 2, 0],
                [9, 1, 0],
                [10, 0, 0]
            ],
            "113": [
                [0, 1, 3],
                [0, 4, 2],
                [0, 7, 1],
                [0, 10, 0],
                [1, 0, 3],
                [1, 3, 2],
                [1, 6, 1],
                [1, 9, 0],
                [2, 2, 2],
                [2, 5, 1],
                [2, 8, 0],
                [3, 1, 2],
                [3, 4, 1],
                [3, 7, 0],
                [4, 0, 2],
                [4, 3, 1],
                [4, 6, 0],
                [5, 2, 1],
                [5, 5, 0],
                [6, 1, 1],
                [6, 4, 0],
                [7, 0, 1],
                [7, 3, 0],
                [8, 2, 0],
                [9, 1, 0],
                [10, 0, 0]
            ],
            "114": [
                [0, 2, 2],
                [0, 6, 1],
                [0, 10, 0],
                [1, 1, 2],
                [1, 5, 1],
                [1, 9, 0],
                [2, 0, 2],
                [2, 4, 1],
                [2, 8, 0],
                [3, 3, 1],
                [3, 7, 0],
                [4, 2, 1],
                [4, 6, 0],
                [5, 1, 1],
                [5, 5, 0],
                [6, 0, 1],
                [6, 4, 0],
                [7, 3, 0],
                [8, 2, 0],
                [9, 1, 0],
                [10, 0, 0]
            ],
            "121": [
                [0, 0, 10],
                [0, 1, 8],
                [0, 2, 6],
                [0, 3, 4],
                [0, 4, 2],
                [0, 5, 0],
                [1, 0, 9],
                [1, 1, 7],
                [1, 2, 5],
                [1, 3, 3],
                [1, 4, 1],
                [2, 0, 8],
                [2, 1, 6],
                [2, 2, 4],
                [2, 3, 2],
                [2, 4, 0],
                [3, 0, 7],
                [3, 1, 5],
                [3, 2, 3],
                [3, 3, 1],
                [4, 0, 6],
                [4, 1, 4],
                [4, 2, 2],
                [4, 3, 0],
                [5, 0, 5],
                [5, 1, 3],
                [5, 2, 1],
                [6, 0, 4],
                [6, 1, 2],
                [6, 2, 0],
                [7, 0, 3],
                [7, 1, 1],
                [8, 0, 2],
                [8, 1, 0],
                [9, 0, 1],
                [10, 0, 0]
            ],
            "122": [
                [0, 0, 5],
                [0, 1, 4],
                [0, 2, 3],
                [0, 3, 2],
                [0, 4, 1],
                [0, 5, 0],
                [2, 0, 4],
                [2, 1, 3],
                [2, 2, 2],
                [2, 3, 1],
                [2, 4, 0],
                [4, 0, 3],
                [4, 1, 2],
                [4, 2, 1],
                [4, 3, 0],
                [6, 0, 2],
                [6, 1, 1],
                [6, 2, 0],
                [8, 0, 1],
                [8, 1, 0],
                [10, 0, 0]
            ],
            "123": [
                [0, 2, 2],
                [0, 5, 0],
                [1, 0, 3],
                [1, 3, 1],
                [2, 1, 2],
                [2, 4, 0],
                [3, 2, 1],
                [4, 0, 2],
                [4, 3, 0],
                [5, 1, 1],
                [6, 2, 0],
                [7, 0, 1],
                [8, 1, 0],
                [10, 0, 0]
            ],
            "131": [
                [0, 0, 10],
                [0, 1, 7],
                [0, 2, 4],
                [0, 3, 1],
                [1, 0, 9],
                [1, 1, 6],
                [1, 2, 3],
                [1, 3, 0],
                [2, 0, 8],
                [2, 1, 5],
                [2, 2, 2],
                [3, 0, 7],
                [3, 1, 4],
                [3, 2, 1],
                [4, 0, 6],
                [4, 1, 3],
                [4, 2, 0],
                [5, 0, 5],
                [5, 1, 2],
                [6, 0, 4],
                [6, 1, 1],
                [7, 0, 3],
                [7, 1, 0],
                [8, 0, 2],
                [9, 0, 1],
                [10, 0, 0]
            ],
            "132": [
                [0, 0, 5],
                [0, 2, 2],
                [1, 1, 3],
                [1, 3, 0],
                [2, 0, 4],
                [2, 2, 1],
                [3, 1, 2],
                [4, 0, 3],
                [4, 2, 0],
                [5, 1, 1],
                [6, 0, 2],
                [7, 1, 0],
                [8, 0, 1],
                [10, 0, 0]
            ],
            "141": [
                [0, 0, 10],
                [0, 1, 6],
                [0, 2, 2],
                [1, 0, 9],
                [1, 1, 5],
                [1, 2, 1],
                [2, 0, 8],
                [2, 1, 4],
                [2, 2, 0],
                [3, 0, 7],
                [3, 1, 3],
                [4, 0, 6],
                [4, 1, 2],
                [5, 0, 5],
                [5, 1, 1],
                [6, 0, 4],
                [6, 1, 0],
                [7, 0, 3],
                [8, 0, 2],
                [9, 0, 1],
                [10, 0, 0]
            ],
            "211": [
                [0, 0, 10],
                [0, 1, 9],
                [0, 2, 8],
                [0, 3, 7],
                [0, 4, 6],
                [0, 5, 5],
                [0, 6, 4],
                [0, 7, 3],
                [0, 8, 2],
                [0, 9, 1],
                [0, 10, 0],
                [1, 0, 8],
                [1, 1, 7],
                [1, 2, 6],
                [1, 3, 5],
                [1, 4, 4],
                [1, 5, 3],
                [1, 6, 2],
                [1, 7, 1],
                [1, 8, 0],
                [2, 0, 6],
                [2, 1, 5],
                [2, 2, 4],
                [2, 3, 3],
                [2, 4, 2],
                [2, 5, 1],
                [2, 6, 0],
                [3, 0, 4],
                [3, 1, 3],
                [3, 2, 2],
                [3, 3, 1],
                [3, 4, 0],
                [4, 0, 2],
                [4, 1, 1],
                [4, 2, 0],
                [5, 0, 0]
            ],
            "212": [
                [0, 0, 5],
                [0, 2, 4],
                [0, 4, 3],
                [0, 6, 2],
                [0, 8, 1],
                [0, 10, 0],
                [1, 0, 4],
                [1, 2, 3],
                [1, 4, 2],
                [1, 6, 1],
                [1, 8, 0],
                [2, 0, 3],
                [2, 2, 2],
                [2, 4, 1],
                [2, 6, 0],
                [3, 0, 2],
                [3, 2, 1],
                [3, 4, 0],
                [4, 0, 1],
                [4, 2, 0],
                [5, 0, 0]
            ],
            "213": [
                [0, 1, 3],
                [0, 4, 2],
                [0, 7, 1],
                [0, 10, 0],
                [1, 2, 2],
                [1, 5, 1],
                [1, 8, 0],
                [2, 0, 2],
                [2, 3, 1],
                [2, 6, 0],
                [3, 1, 1],
                [3, 4, 0],
                [4, 2, 0],
                [5, 0, 0]
            ],
            "221": [
                [0, 0, 10],
                [0, 1, 8],
                [0, 2, 6],
                [0, 3, 4],
                [0, 4, 2],
                [0, 5, 0],
                [1, 0, 8],
                [1, 1, 6],
                [1, 2, 4],
                [1, 3, 2],
                [1, 4, 0],
                [2, 0, 6],
                [2, 1, 4],
                [2, 2, 2],
                [2, 3, 0],
                [3, 0, 4],
                [3, 1, 2],
                [3, 2, 0],
                [4, 0, 2],
                [4, 1, 0],
                [5, 0, 0]
            ],
            "222": [
                [0, 0, 5],
                [0, 1, 4],
                [0, 2, 3],
                [0, 3, 2],
                [0, 4, 1],
                [0, 5, 0],
                [1, 0, 4],
                [1, 1, 3],
                [1, 2, 2],
                [1, 3, 1],
                [1, 4, 0],
                [2, 0, 3],
                [2, 1, 2],
                [2, 2, 1],
                [2, 3, 0],
                [3, 0, 2],
                [3, 1, 1],
                [3, 2, 0],
                [4, 0, 1],
                [4, 1, 0],
                [5, 0, 0]
            ],
            "231": [
                [0, 0, 10],
                [0, 1, 7],
                [0, 2, 4],
                [0, 3, 1],
                [1, 0, 8],
                [1, 1, 5],
                [1, 2, 2],
                [2, 0, 6],
                [2, 1, 3],
                [2, 2, 0],
                [3, 0, 4],
                [3, 1, 1],
                [4, 0, 2],
                [5, 0, 0]
            ],
            "311": [
                [0, 0, 10],
                [0, 1, 9],
                [0, 2, 8],
                [0, 3, 7],
                [0, 4, 6],
                [0, 5, 5],
                [0, 6, 4],
                [0, 7, 3],
                [0, 8, 2],
                [0, 9, 1],
                [0, 10, 0],
                [1, 0, 7],
                [1, 1, 6],
                [1, 2, 5],
                [1, 3, 4],
                [1, 4, 3],
                [1, 5, 2],
                [1, 6, 1],
                [1, 7, 0],
                [2, 0, 4],
                [2, 1, 3],
                [2, 2, 2],
                [2, 3, 1],
                [2, 4, 0],
                [3, 0, 1],
                [3, 1, 0]
            ],
            "312": [
                [0, 0, 5],
                [0, 2, 4],
                [0, 4, 3],
                [0, 6, 2],
                [0, 8, 1],
                [0, 10, 0],
                [1, 1, 3],
                [1, 3, 2],
                [1, 5, 1],
                [1, 7, 0],
                [2, 0, 2],
                [2, 2, 1],
                [2, 4, 0],
                [3, 1, 0]
            ],
            "321": [
                [0, 0, 10],
                [0, 1, 8],
                [0, 2, 6],
                [0, 3, 4],
                [0, 4, 2],
                [0, 5, 0],
                [1, 0, 7],
                [1, 1, 5],
                [1, 2, 3],
                [1, 3, 1],
                [2, 0, 4],
                [2, 1, 2],
                [2, 2, 0],
                [3, 0, 1]
            ],
            "411": [
                [0, 0, 10],
                [0, 1, 9],
                [0, 2, 8],
                [0, 3, 7],
                [0, 4, 6],
                [0, 5, 5],
                [0, 6, 4],
                [0, 7, 3],
                [0, 8, 2],
                [0, 9, 1],
                [0, 10, 0],
                [1, 0, 6],
                [1, 1, 5],
                [1, 2, 4],
                [1, 3, 3],
                [1, 4, 2],
                [1, 5, 1],
                [1, 6, 0],
                [2, 0, 2],
                [2, 1, 1],
                [2, 2, 0]
            ]
        }
        let key = this.counts.join('');
        let currentSet = sets[key];
        for (let i = 0; i < currentSet.length; i++) {
            if (this.isEqual(currentSet[i], this.values)) {
                currentSet.splice(i, 1);
            }
        }
        return currentSet;
    }

};
