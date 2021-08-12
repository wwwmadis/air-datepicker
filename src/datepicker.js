import defaults from './defaults';
import {
    copyDate,
    createElement,
    deepCopy,
    getDecade,
    getEl,
    getParsedDate,
    getLeadingZeroNum,
    insertAfter,
    isDateBigger,
    isDateSmaller,
    isSameDate,
    deepMerge,
    createDate,
    getWordBoundaryRegExp,
    getClosestScrollableParent,
} from './utils';
import DatepickerBody from './datepickerBody';
import DatepickerNav from './datepickerNav';
import DatepickerButtons from './datepickerButtons';
import DatepickerTime from './datepickerTime';
import DatepickerKeyboard from './datepickerKeyboard';
import withEvents from './withEvents';
import consts from './consts';

import './datepickerVars.scss';
import './datepicker.scss';

let $body = '',
    $datepickersContainer = '',
    containerBuilt = false,
    baseTemplate = '' +
            '<i class="datepicker--pointer"></i>' +
            '<div class="datepicker--navigation"></div>' +
            '<div class="datepicker--content"></div>';

function buildDatepickersContainer (id) {
    containerBuilt = true;

    $datepickersContainer = createElement({className: id, id});
    $body.appendChild($datepickersContainer);

    return $datepickersContainer;
}

export default class Datepicker {
    static defaults = defaults
    static defaultContainerId = 'datepickers-container'
    constructor(el, opts) {
        this.$el = getEl(el);
        this.$datepicker = createElement({className: 'datepicker'});
        this.opts = deepMerge({}, defaults, opts);
        if (!$body) {
            $body = getEl('body');
        }

        let {view, startDate} = this.opts;

        if (!startDate) {
            this.opts.startDate = new Date();
        }

        if (this.$el.nodeName === 'INPUT') {
            this.elIsInput = true;
        }

        this.inited = false;
        this.visible = false;

        this.viewDate = createDate(this.opts.startDate);
        this.focusDate = false;
        this.currentView = view;
        this.selectedDates = [];
        this.views = {};
        this.keys = [];
        this.rangeDateFrom = '';
        this.rangeDateTo = '';
        this._prevOnSelectValue = '';
        this.$scrollableParent = false;

        this.init();
    }

    viewIndexes = [consts.days, consts.months, consts.years];

    init(){
        let {
            opts,
            opts: {
                inline,
                buttons,
                selectedDates,
                timepicker,
                position,
                classes,
                altField,
                onlyTimepicker,
                keyboardNav
            }
        } = this;
        let dp = this;

        if (!containerBuilt && !inline && this.elIsInput) {
            buildDatepickersContainer(Datepicker.defaultContainerId);
        }
        this._buildBaseHtml();
        this._handleLocale();
        this._bindSubEvents();

        if (altField) {
            this.$altField = getEl(altField);
        }

        this._limitViewDateByMaxMinDates();

        if (this.elIsInput) {
            if (!inline) {
                this._setPositionClasses(position);
                this._bindEvents();
            }

            if (keyboardNav && !onlyTimepicker) {
                this.keyboardNav = new DatepickerKeyboard({dp: this, opts});
            }
        }

        if (inline || !this.elIsInput) {
            this.$datepicker.classList.add('-inline-');
        }

        if (classes) {
            this.$datepicker.classList.add(...classes.split(' '));
        }

        if (onlyTimepicker) {
            this.$datepicker.classList.add('-only-timepicker-');
        }

        this.views[this.currentView] = new DatepickerBody({
            dp,
            type: this.currentView,
            opts
        });

        this.nav = new DatepickerNav({dp,opts,});

        if (timepicker) {
            this._addTimepicker();
        }

        if (buttons) {
            this._addButtons();
        }

        this.$content.appendChild(this.views[this.currentView].$el);
        this.$nav.appendChild(this.nav.$el);

        if (selectedDates) {
            this.selectDate(selectedDates, {silent: true});
        }
    }

    _addTimepicker() {
        this.$timepicker = createElement({className: 'datepicker--time'});
        this.$datepicker.appendChild(this.$timepicker);
        this.timepicker = new DatepickerTime({dp: this, opts: this.opts});
        this.$timepicker.appendChild(this.timepicker.$el);
    }

    _addButtons() {
        this.$buttons = createElement({className: 'datepicker--buttons'});
        this.$datepicker.appendChild(this.$buttons);
        this.buttons = new DatepickerButtons({dp: this, opts: this.opts});
        this.$buttons.appendChild(this.buttons.$el);
    }

    _bindSubEvents(){
        this.on(consts.eventChangeSelectedDate, this._onChangeSelectedDate);
        this.on(consts.eventChangeFocusDate, this._onChangeFocusedDate);
        this.on(consts.eventChangeTime, this._onChangeTime);
    }

    _buildBaseHtml() {
        let {inline} = this.opts;

        if  (this.elIsInput) {
            if (!inline) {
                $datepickersContainer.appendChild(this.$datepicker);
            } else {
                insertAfter(this.$datepicker, this.$el);
            }
        } else {
            this.$el.appendChild(this.$datepicker);
        }

        this.$datepicker.innerHTML = baseTemplate;

        this.$content = getEl('.datepicker--content',  this.$datepicker);
        this.$nav = getEl('.datepicker--navigation', this.$datepicker);
    }

    _handleLocale(){
        let {locale, dateFormat, firstDay, timepicker, onlyTimepicker, timeFormat, dateTimeSeparator} = this.opts;
        this.locale = deepCopy(locale);

        if (dateFormat) {
            this.locale.dateFormat = dateFormat;
        }
        // Allow to remove time from formatted string
        // e.g. if user wants to display mm:hh yyyy MMMM (time first) instead of hardcoded order - 'date time`
        if (timeFormat !== undefined && timeFormat !== '') {
            this.locale.timeFormat = timeFormat;
        }

        let {timeFormat: timeFormatValidated} = this.locale;

        if (firstDay !== '') {
            this.locale.firstDay = firstDay;
        }

        if (timepicker && typeof dateFormat !== 'function') {
            let separator = timeFormatValidated ? dateTimeSeparator : '';
            this.locale.dateFormat = [this.locale.dateFormat, (timeFormatValidated ? timeFormatValidated : '')].join(separator);
        }

        if (onlyTimepicker) {
            this.locale.dateFormat = this.locale.timeFormat;
        }
    }

    _setPositionClasses(pos){
        pos = pos.split(' ');
        let main = pos[0],
            sec = pos[1],
            classes = `datepicker -${main}-${sec}- -from-${main}-`;

        if (this.visible) classes += ' active';

        this.$datepicker.removeAttribute('class');
        this.$datepicker.classList.add(...classes.split(' '));
    }

    _bindEvents(){
        this.$el.addEventListener(this.opts.showEvent, this._onFocus);
        this.$el.addEventListener('blur', this._onBlur);
        this.$datepicker.addEventListener('mousedown', this._onMouseDown);
        this.$datepicker.addEventListener('mouseup', this._onMouseUp);
    }

    _limitViewDateByMaxMinDates(){
        let {viewDate, opts: {minDate, maxDate}} = this;

        if (maxDate && isDateBigger(viewDate, maxDate)) {
            this.setViewDate(maxDate);
        }
        if (minDate && isDateSmaller(viewDate, minDate)) {
            this.setViewDate(minDate);
        }
    }

    formatDate(string, date=this.viewDate) {
        date = createDate(date);

        if (!(date instanceof Date)) return;

        let result = string,
            locale = this.locale,
            parsedDate = getParsedDate(date),
            decade = getDecade(date),
            replacer = Datepicker.replacer,
            dayPeriod = 'am';

        if (this.opts.timepicker && this.timepicker) {
            dayPeriod = this.timepicker.getDayPeriod(date).dayPeriod;
        }

        let formats = {
            // Time in ms
            T: date.getTime(),

            // Minutes
            m: parsedDate.minutes,
            mm: parsedDate.fullMinutes,

            // Hours
            h: parsedDate.hours12,
            hh: parsedDate.fullHours12,
            H: parsedDate.hours,
            HH: parsedDate.fullHours,

            // Day period
            aa: dayPeriod,
            AA: dayPeriod.toUpperCase(),

            // Day of week
            E: locale.daysShort[parsedDate.day],
            EEEE: locale.days[parsedDate.day],

            // Date of month
            d: parsedDate.date,
            dd: parsedDate.fullDate,

            // Months
            M: parsedDate.month + 1,
            MM: parsedDate.fullMonth,
            MMM: locale.monthsShort[parsedDate.month],
            MMMM: locale.months[parsedDate.month],

            // Years
            yy: parsedDate.year.toString().slice(-2),
            yyyy: parsedDate.year,
            yyyy1: decade[0],
            yyyy2: decade[1]
        };


        for (let [format, data] of Object.entries(formats)) {
            result = replacer(result, getWordBoundaryRegExp(format), data);
        }

        return result;
    }

    /**
     * Changes month, year, decade to next period
     */
    next = () => {
        let {year, month} = this.parsedViewDate;

        switch (this.currentView) {
            case consts.days:
                this.setViewDate(new Date(year, month + 1, 1));
                break;
            case consts.months:
                this.setViewDate(new Date(year + 1, month, 1));
                break;
            case consts.years:
                this.setViewDate(new Date(year + 10, 0, 1));
                break;
        }
    }

    /**
     * Changes month, year, decade to prev period
     */
    prev = () => {
        let {year, month} = this.parsedViewDate;

        switch (this.currentView) {
            case consts.days:
                this.setViewDate(new Date(year, month - 1, 1));
                break;
            case consts.months:
                this.setViewDate(new Date(year - 1, month, 1));
                break;
            case consts.years:
                this.setViewDate(new Date(year - 10, 0, 1));
                break;
        }
    }

    down(date) {
        this._handleUpDownActions(date, 'down');
    }

    up(date) {
        this._handleUpDownActions(date, 'up');
    }

    /**
     * Selects date, if array is passed then selects dates one by one
     * @param {Date|string|number|Array<Date|number|string>} date
     * @param {object} [params] - extra parameters
     * @param {boolean} [params.updateTime] - should update timepicker's time from passed date
     * @param {boolean} [params.silent] - if true, then onChange event wont be triggered
     * @return {Promise<unknown>} - returns promise, since input value updates asynchronously, after promise resolves, we need a promise tobe able to get current input value
     */
    selectDate(date, params = {}) {
        let {currentView, parsedViewDate, selectedDates} = this;
        let {updateTime} = params;
        let {
            moveToOtherMonthsOnSelect,
            moveToOtherYearsOnSelect,
            multipleDates,
            range,
            autoClose
        } = this.opts;
        let selectedDaysLen = selectedDates.length;
        let newViewDate;

        if (Array.isArray(date)) {
            date.forEach((d) => {
                this.selectDate(d, params);
            });

            return new Promise((resolve) => {
                setTimeout(resolve);
            });
        }

        date = createDate(date);

        if (!(date instanceof Date)) return;

        // Checks if selected date is out of current month or decade
        // If so, change `viewDate`
        if (currentView === consts.days) {
            if (date.getMonth() !== parsedViewDate.month && moveToOtherMonthsOnSelect) {
                newViewDate = new Date(date.getFullYear(), date.getMonth(), 1);
            }
        }

        if (currentView === consts.years) {
            if (date.getFullYear() !== parsedViewDate.year && moveToOtherYearsOnSelect) {
                newViewDate = new Date(date.getFullYear(), 0, 1);
            }
        }

        if (newViewDate) {
            this.setViewDate(newViewDate);
        }

        if (multipleDates && !range) {
            if (selectedDaysLen === multipleDates) return;
            if (!this._checkIfDateIsSelected(date)) {
                selectedDates.push(date);
            }
        } else if (range) {
            switch (selectedDaysLen) {
                case 1:
                    selectedDates.push(date);
                    // Need to define this manually if call selectDate programmatically
                    if (!this.rangeDateTo){
                        this.rangeDateTo = date;
                    }
                    // Swap dates if they were selected via dp.selectDate() and second date was smaller then first
                    if (isDateBigger(this.rangeDateFrom, this.rangeDateTo)) {
                        this.rangeDateTo = this.rangeDateFrom;
                        this.rangeDateFrom = date;
                    }
                    this.selectedDates = [this.rangeDateFrom, this.rangeDateTo];
                    break;
                case 2:
                    this.selectedDates = [date];
                    this.rangeDateFrom = date;
                    this.rangeDateTo = '';
                    break;
                default:
                    this.selectedDates = [date];
                    this.rangeDateFrom = date;
            }
        } else {
            this.selectedDates = [date];
        }

        this.trigger(consts.eventChangeSelectedDate, {
            action: consts.actionSelectDate,
            silent: params?.silent,
            date,
            updateTime
        });
        this._updateLastSelectedDate(date);

        if (autoClose && !this.timepickerIsActive) {
            if (!multipleDates && !range) {
                this.hide();
            } else if (range && selectedDaysLen === 2) {
                this.hide();
            }
        }

        return new Promise((resolve) => {
            setTimeout(resolve);
        });
    }

    unselectDate(date){
        let selected = this.selectedDates,
            _this = this;

        date = createDate(date);

        if (!(date instanceof Date)) return;

        return selected.some((curDate, i) => {
            if (isSameDate(curDate, date)) {
                selected.splice(i, 1);

                if (!_this.selectedDates.length) {
                    _this.rangeDateFrom = '';
                    _this.rangeDateTo = '';
                    _this._updateLastSelectedDate(false);
                } else {
                    _this._updateLastSelectedDate(_this.selectedDates[_this.selectedDates.length - 1]);
                }

                this.trigger(consts.eventChangeSelectedDate, {action: consts.actionUnselectDate,  date});

                return true;
            }
        });
    }

    replaceDate(selectedDate, newDate) {
        let date = this.selectedDates.find((d) => {
            return isSameDate(d, selectedDate, this.currentView);
        });
        let index = this.selectedDates.indexOf(date);

        if (index < 0) return;

        // Add check if same date exists, if so don't trigger change events
        if (isSameDate(this.selectedDates[index], newDate, this.currentView)) {
            return;
        }

        this.selectedDates[index] = newDate;

        this.trigger(consts.eventChangeSelectedDate, {
            action: consts.actionSelectDate,
            date: newDate,
            updateTime: true
        });

        this._updateLastSelectedDate(newDate);
    }

    clear(){
        this.selectedDates = [];
        this.rangeDateFrom = false;
        this.rangeDateTo = false;

        this.trigger(consts.eventChangeSelectedDate, {action: consts.actionUnselectDate});
    }

    show(){
        this.setPosition(this.opts.position);
        this.$datepicker.classList.add('-active-');
        this.visible = true;

        this.$scrollableParent = getClosestScrollableParent(this.$el);

        if (this.$scrollableParent && !this.$scrollableParent.matches('html')) {
            this.$scrollableParent.addEventListener('scroll', this._onScrollParent);
        }

        let {onShow} = this.opts;

        if (onShow) {
            this._handleVisibilityEvents(onShow);
        }
    }

    hide(){
        this.$datepicker.classList.remove('-active-');
        this.$datepicker.style.left = '-10000px';
        this.visible = false;

        if (this.$scrollableParent) {
            this.$scrollableParent.removeEventListener('scroll', this._onScrollParent);
        }

        if (this.elIsInput) {
            this.$el.blur();
        }

        let {onHide} = this.opts;

        if (onHide) {
            this._handleVisibilityEvents(onHide);
        }
    }

    setPosition = (position) => {
        position = position || this.opts.position;

        let dims = this.$el.getBoundingClientRect(),
            selfDims = this.$datepicker.getBoundingClientRect(),
            pos = position.split(' '),
            top, left,
            offset = this.opts.offset,
            main = pos[0],
            secondary = pos[1];

        switch (main) {
            case 'top':
                top = dims.top - selfDims.height - offset;
                break;
            case 'right':
                left = dims.left + dims.width + offset;
                break;
            case 'bottom':
                top = dims.top + dims.height + offset;
                break;
            case 'left':
                left = dims.left - selfDims.width - offset;
                break;
        }

        switch(secondary) {
            case 'top':
                top = dims.top;
                break;
            case 'right':
                left = dims.left + dims.width - selfDims.width;
                break;
            case 'bottom':
                top = dims.top + dims.height - selfDims.height;
                break;
            case 'left':
                left = dims.left;
                break;
            case 'center':
                if (/left|right/.test(main)) {
                    top = dims.top + dims.height/2 - selfDims.height/2;
                } else {
                    left = dims.left + dims.width/2 - selfDims.width/2;
                }
        }

        this.$datepicker.style.cssText = `left: ${left + window.scrollX}px; top: ${top + window.scrollY}px`;
    }

    setInputValue = () => {
        let {opts: {altFieldDateFormat, altField, multipleDatesSeparator}, selectedDates, $altField, locale} = this,
            value = selectedDates.map((date) => {
                if (typeof locale.dateFormat === 'function') {
                    return locale.dateFormat(date);
                }
                return this.formatDate(locale.dateFormat, date);
            }),
            altValues;

        if (altField && $altField) {
            altValues = selectedDates.map((date) => {
                if (typeof altFieldDateFormat === 'function') {
                    return altFieldDateFormat(date);
                }

                return this.formatDate(altFieldDateFormat, date);
            });
            altValues = altValues.join(multipleDatesSeparator);
            $altField.value = altValues;
        }

        value = value.join(multipleDatesSeparator);

        this.$el.value = value;
    }

    _triggerOnSelect(){
        let dates = [],
            formattedDates = [],
            datepicker = this,
            {selectedDates, locale, opts: {onSelect, multipleDates}} = datepicker;

        if (selectedDates.length) {
            dates = selectedDates.map(copyDate);
            formattedDates = dates.map((date) => {
                if (typeof locale.dateFormat === 'function') {
                    return locale.dateFormat(date);
                }

                return this.formatDate(locale.dateFormat, date);
            });
        }

        onSelect({
            date: multipleDates ? dates : dates[0],
            formattedDate: multipleDates ? formattedDates : formattedDates[0],
            datepicker
        });
    }

    /**
     * Checks if date is already selected, returns selected date if finds one
     * Returns selected date, need for timepicker
     * @param {Date} date
     * @param {String} cellType - days, months, years
     * @return {boolean|Date}
     * @private
     */
    _checkIfDateIsSelected = (date, cellType=consts.days) =>{
        let alreadySelectedDate = false;

        this.selectedDates.some((selectedDate)=>{
            let same = isSameDate(date, selectedDate, cellType);
            alreadySelectedDate = same && selectedDate;
            return same;
        });

        return alreadySelectedDate;
    }

    _handleAlreadySelectedDates(alreadySelectedDate, newSelectedDate){
        let {range, toggleSelected} = this.opts;
        if (range) {
            if (!toggleSelected) {
                // Add possibility to select same date when range is true
                if (this.selectedDates.length !== 2) {
                    this.selectDate(newSelectedDate);
                }
            } else {
                this.unselectDate(newSelectedDate);
            }
        } else if (toggleSelected){
            this.unselectDate(newSelectedDate);
        }

        // Change last selected date to be able to change time when clicking on this cell
        if (!toggleSelected) {
            this._updateLastSelectedDate(alreadySelectedDate);
        }
    }

    _handleUpDownActions(date, dir) {
        date = createDate(date) || this.focusDate || this.viewDate;

        if (!(date instanceof Date)) return;

        let nextView = dir === 'up' ? this.viewIndex + 1 : this.viewIndex - 1;
        if (nextView > 2) nextView = 2;
        if (nextView < 0) nextView = 0;

        this.setViewDate(new Date(date.getFullYear(), date.getMonth(), 1));
        this.setCurrentView(this.viewIndexes[nextView]);
    }

    _handleRangeOnFocus(){
        if (this.selectedDates.length === 1) {
            let selectedDate = this.selectedDates[0];
            if (isDateBigger(selectedDate, this.focusDate)) {
                this.rangeDateTo =  this.selectedDates[0];
                this.rangeDateFrom = this.focusDate;
            } else {
                this.rangeDateTo = this.focusDate;
                this.rangeDateFrom = this.selectedDates[0];
            }
        }
    }

    _handleVisibilityEvents = (cb) => {
        if (this._onTransitionEnd) {
            this.$datepicker.removeEventListener('transitionend', this._onTransitionEnd);
        }

        cb(false);

        this._onTransitionEnd = () => {
            cb(true);
        };

        this.$datepicker.addEventListener('transitionend', this._onTransitionEnd, {once: true});
    }

    /**
     * Sets new view date of datepicker
     * @param {Date} date
     */
    setViewDate = (date) => {
        date = createDate(date);

        if (!(date instanceof Date)) return;

        if (isSameDate(date, this.viewDate)) return;
        this.viewDate = date;
        let {onChangeViewDate} = this.opts;

        if (onChangeViewDate) {
            let {month, year} = this.parsedViewDate;
            onChangeViewDate({
                month,
                year,
                decade: this.curDecade
            });
        }

        this.trigger(consts.eventChangeViewDate, date);
    }

    /**
     * Sets new focusDate
     * @param {Date} date
     * @param {Object} [params]
     * @param {Boolean} params.viewDateTransition
     */
    setFocusDate = (date, params = {}) => {
        date = createDate(date);

        if (!(date instanceof Date)) return;

        this.focusDate = date;

        if (this.opts.range && date) {
            this._handleRangeOnFocus();
        }

        this.trigger(consts.eventChangeFocusDate, date, params);
    }

    setCurrentView = (view) => {
        if (!this.viewIndexes.includes(view)) return;

        if (!this.views[view]) {
            let newView = this.views[view] = new DatepickerBody({
                dp: this,
                opts: this.opts,
                type: view
            });

            this.$content.appendChild(newView.$el);
        }

        this.currentView = view;

        if (this.elIsInput && this.visible) this.setPosition();

        if (this.opts.onChangeView) {
            this.opts.onChangeView(view);
        }

        this.trigger(consts.eventChangeCurrentView, view);
    }

    /**
     * Updates lastSelectedDate param and triggers corresponding event
     * @param {Date|Boolean} date - date or empty
     */
    _updateLastSelectedDate = (date) =>{
        this.lastSelectedDate = date;
        this.trigger(consts.eventChangeLastSelectedDate, date);
    }

    getCell(jsDate, cellType = consts.day) {
        let {year, month, date} = getParsedDate(jsDate);

        let yearQuery = `[data-year="${year}"]`,
            monthQuery = `[data-month="${month}"]`,
            dayQuery = `[data-date="${date}"]`;

        let resultQuery = {
            [consts.day]: `${yearQuery}${monthQuery}${dayQuery}`,
            [consts.month]: `${yearQuery}${monthQuery}`,
            [consts.year]: `${yearQuery}`,
        }

        return this.views[this.currentView].$el.querySelector(resultQuery[cellType]);
    }

    destroy = () =>{
        let parent = this.$datepicker.parentNode;
        if (parent) {
            parent.removeChild(this.$datepicker);
        }

        this.$el.removeEventListener(this.opts.showEvent, this._onFocus);
        this.$el.removeEventListener('blur', this._onBlur);

        if (this.keyboardNav) {
            this.keyboardNav.destroy();
        }

        this.views = null;
        this.nav = null;
    }

    update = (newOpts) => {
        let prevOpts = deepMerge({}, this.opts);
        deepMerge(this.opts, newOpts);

        let {timepicker, buttons, range, selectedDates} = this.opts;

        if (prevOpts.range && !range) {
            this.rangeDateTo = false;
            this.rangeDateFrom = false;
        } else if (!prevOpts.range && range) {
            if (this.selectedDates.length) {
                this.rangeDateFrom = this.selectedDates[0];
                this.rangeDateTo = this.selectedDates[1];
            }
        }

        if (prevOpts.timepicker && !timepicker) {
            this.timepicker.destroy();
            this.$timepicker.parentNode.removeChild(this.$timepicker);
        } else if (!prevOpts.timepicker && timepicker) {
            this._addTimepicker();
        }

        if (!prevOpts.buttons && buttons) {
            this._addButtons();
        } else if (prevOpts.buttons && !buttons) {
            this.buttons.destroy();
            this.$buttons.parentNode.removeChild(this.$buttons);
        }

        if (selectedDates) {
            this.selectDate(selectedDates)
        }

        if (newOpts.view) {
            this.setCurrentView(newOpts.view)
        }

        this._limitViewDateByMaxMinDates();
        this._handleLocale();
        this.nav.update();
        this.views[this.currentView].render();
        if (this.currentView === consts.days) {
            this.views[this.currentView].renderDayNames();
        }
        this.setInputValue();
    }

    //  Utils
    // -------------------------------------------------

    isOtherMonth = (date) => {
        let {month} = getParsedDate(date);

        return month !== this.parsedViewDate.month;
    }

    isOtherYear = (date) => {
        let {year} = getParsedDate(date);

        return year !== this.parsedViewDate.year;
    }

    isOtherDecade = (date) => {
        let {year} = getParsedDate(date);
        let [firstDecadeYear, lastDecadeYear] = getDecade(this.viewDate);

        return year < firstDecadeYear || year > lastDecadeYear;
    }

    //  Subscription events
    // -------------------------------------------------

    _onChangeSelectedDate = ({silent}) =>{
        // Use timeout here for wait for all changes that could be made to selected date (e.g. timepicker adds time)
        setTimeout(() => {
            this.setInputValue();
            if (this.opts.onSelect && !silent) {
                this._triggerOnSelect();
            }
        });
    }

    _onChangeFocusedDate = (date, {viewDateTransition} = {}) =>{
        if (!date) return;
        let shouldPerformTransition = false;

        if (viewDateTransition) {
            shouldPerformTransition = this.isOtherMonth(date) || this.isOtherYear(date) || this.isOtherDecade(date);
        }

        if (shouldPerformTransition) {
            this.setViewDate(date);
        }

    }

    _onChangeTime = ({hours, minutes}) =>{
        let today = new Date();
        let {lastSelectedDate, opts: {onSelect}} = this;
        let targetDate = lastSelectedDate;

        if (!lastSelectedDate) {
            targetDate = today;
        }

        let $cell = this.getCell(targetDate);
        let cell = $cell && $cell.adpCell;

        if (cell && cell.isDisabled) return;

        targetDate.setHours(hours);
        targetDate.setMinutes(minutes);

        if (!lastSelectedDate) {
            this.selectDate(targetDate);
        } else {
            this.setInputValue();
            if (onSelect) {
                this._triggerOnSelect();
            }
        }
    }

    _onFocus = () => {
        if (!this.visible) {
            this.show();
        }
    }

    _onBlur = (e) => {
        if (!this.inFocus && this.visible) {
            this.hide();
        }
    }

    _onMouseDown = (e) => {
        this.inFocus = true;
    }

    _onMouseUp = (e) => {
        this.inFocus = false;
        this.$el.focus();
    }

    _onScrollParent = (e) => {
        if (this.visible) {
            this.setPosition();
        }
    }

    //  Helpers
    // -------------------------------------------------

    get parsedViewDate(){
        return getParsedDate(this.viewDate);
    }

    get curDecade() {
        return getDecade(this.viewDate);
    }

    get viewIndex(){
        return this.viewIndexes.indexOf(this.currentView);
    }

    get isFinalView(){
        return this.currentView === consts.years;
    }

    get hasSelectedDates(){
        return this.selectedDates.length > 0;
    }

    get isMinViewReached(){
        return this.currentView === this.opts.minView || this.currentView === consts.days;
    }

    isWeekend = (day) => {
        return this.opts.weekends.includes(day);
    }

    /**
     * Clamps passed date between min and max date
     * @param {Date} date
     */
    getClampedDate = (date) => {
        let {minDate, maxDate} = this.opts,
            newDate = date;

        if (maxDate && isDateBigger(date, maxDate)) {
            newDate = maxDate;
        } else if (minDate && isDateSmaller(date, minDate)) {
            newDate = minDate;
        }

        return newDate;
    }

    static replacer(str, reg, data) {
        return str.replace(reg, function (match, p1,p2,p3) {
            return p1 + data + p3;
        });
    }
}

withEvents(Datepicker.prototype);
