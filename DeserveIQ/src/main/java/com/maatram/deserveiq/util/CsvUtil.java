package com.maatram.deserveiq.util;

import org.apache.commons.csv.*;
import java.io.*;
import java.util.*;

public class CsvUtil {

    public static List<Map<String, String>> readCsvAsMaps(InputStream in) throws IOException {
        Reader r = new InputStreamReader(in);
        CSVParser parser = CSVFormat.DEFAULT.withFirstRecordAsHeader().parse(r);
        List<Map<String, String>> rows = new ArrayList<>();
        for (CSVRecord rec : parser) {
            Map<String, String> map = new LinkedHashMap<>();
            for (String h : parser.getHeaderNames()) {
                map.put(h, rec.get(h));
            }
            rows.add(map);
        }
        return rows;
    }

    public static void writeMapsToCsv(List<Map<String, Object>> rows, OutputStream out) throws IOException {
        if (rows.isEmpty()) return;
        List<String> headers = new ArrayList<>(rows.get(0).keySet());
        BufferedWriter writer = new BufferedWriter(new OutputStreamWriter(out));
        CSVPrinter printer = new CSVPrinter(writer, CSVFormat.DEFAULT.withHeader(headers.toArray(new String[0])));
        for (Map<String, Object> row : rows) {
            List<Object> values = new ArrayList<>();
            for (String h : headers) values.add(row.getOrDefault(h, ""));
            printer.printRecord(values);
        }
        printer.flush();
        printer.close();
    }
}
