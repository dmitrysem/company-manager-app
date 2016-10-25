var app = angular.module('companiesManagerApp', ['ngResource']);

app.factory('Companies', ['$resource', function($resource) {
    return $resource('/companies', null, {
        'update': { method: 'PUT' }
    });
}]);

app.controller('CompaniesController', ['Companies', function(Companies) {
    var self = this;

    Companies.prototype.initializeProps = function() {
        Object.defineProperties(this, {
            children: {
                value: [],
                writable: true
            },

            parent: {
                writable: true,
                configurable: false,
                enumerable: false
            },

            totalEarnings: {
                get: function() {
                    return this.children.reduce(function(sum, company) {
                        return sum + company.totalEarnings;
                    }, +this.earnings);
                }
            }
        });
    };

    self.newCompany = {};
    self.allCompanies = [];
    self.companiesTree = [];

    self.form = {
        visible: false,
        submitLabel: 'Add',
        error: {}
    };

    Object.defineProperty(self.form, 'canBeSubmitted', {
        enumerable: true,
        get: function() {
            return !Object.keys(this.error).length;
        }
    });

    // ---methods---

    self.deleteCompany = function(company, index) {
        company.$delete({id: company._id}, function(company) {
            self.removeFromTree(company, index);
            self.removeFromAll(company);
        });

        company.children.forEach(function(childCompany) {
            self.deleteCompany(childCompany);
        });
    };

    self.submitForm = function() {
        if (!self.form.canBeSubmitted) return;

        if (self.form.editingCompany) {
            var company = self.form.editingCompany;

            company.name = self.newCompany.name;
            company.earnings = self.newCompany.earnings;

            self.removeFromTree(company);

            if (company.parent) delete company.parentName && (company.parent = null);
            if (self.newCompany.parent && self.newCompany.type) {
                company.parent = self.newCompany.parent;
                company.parentName = company.parent.name;
            }

            self.addToTree(company);
            self.addToAll(company);

            delete self.form.editingCompany;

            company.$update({id: company._id}, function(company) {
            });
        } else {
            var company = new Companies(self.newCompany);
            company.initializeProps();

            delete company.type;
            if (company.parent) company.parentName = company.parent.name;

            company.$save(function (company) {
                self.addToTree(company);
                self.addToAll(company);
            });
        }

        self.clearForm();
    };

    self.startEditing = function(company) {
        self.newCompany = {};
        self.newCompany.name = company.name;
        self.newCompany.earnings = +company.earnings;
        if (company.parent) (self.newCompany.type = 'sub') && (self.newCompany.parent = company.parent);

        self.form.visible = true;
        self.form.submitLabel = 'Save';
        self.form.editingCompany = company;

        self.removeFromAll(company);
    };

    self.cancelEditing = function() {
        self.addToAll(self.form.editingCompany);

        delete self.form.editingCompany;

        self.clearForm();
    };

    self.checkInput = function() {
        if (self.form.error.nameExists) delete self.form.error.nameExists;

        for (var i = 0; i < self.allCompanies.length; i++) {
            var company = self.allCompanies[i];

            if (self.newCompany.name === company.name) {
                self.form.error.nameExists = true;
                return;
            }
        }
    };

    self.toggleForm = function() {
        self.form.visible = !self.form.visible;
    };

    self.clearForm = function() {
        self.newCompany = {};
        self.form.visible = false;
        self.form.submitLabel = 'Add';
    };

    self.checkType = function() {
        if (!self.newCompany) return;
        return self.newCompany.type === 'sub' ||
            (self.newCompany.parent && (delete self.newCompany.parent && false));
    };

    self.addToAll = function(company) {
        self.allCompanies.push(company);

        company.children.forEach(function(childCompany) {
            self.addToAll(childCompany);
        });
    };

    self.removeFromAll = function(company) {
        var index = self.allCompanies.indexOf(company);
        if (!~index) return;
        self.allCompanies.splice(index, 1);

        company.children.forEach(function(childCompany) {
            self.removeFromAll(childCompany);
        });
    };

    self.addToTree = function(company) {
        if (!company.parent) self.companiesTree.push(company);
        else company.parent.children.push(company);
    };

    self.removeFromTree = function(company, index) {
        if (!company.parent) {
            index = self.companiesTree.indexOf(company);
            if (!~index) return;
            self.companiesTree.splice(index, 1);
        } else {
            index = company.parent.children.indexOf(company);
            if (!~index) return;
            company.parent.children.splice(index, 1);
        }
    };

    // ---initial get---

    Companies.query(function(companies) {
        companies.forEach(function(company) {
            company.initializeProps();
        });

        self.allCompanies = companies;
        self.companiesTree = makeCompaniesTree(companies);


        function makeCompaniesTree(companies) {
            var companiesTree = [];

            companies.forEach(function(company) {
                if (!company.parentName) return companiesTree.push(company);

                for (var i = 0; i < companies.length; i++) {
                    var otherCompany = companies[i];

                    if (company.parentName === otherCompany.name) {
                        otherCompany.children.push(company);
                        company.parent = otherCompany;
                        return;
                    }
                }
            });

            return companiesTree;
        }
    });
}]);